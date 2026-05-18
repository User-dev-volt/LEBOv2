use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use unity_asset_core::constants::class_ids;
use unity_asset_core::UnityValue;
use unity_asset_decode::bundle::AssetBundle;
use unity_asset_decode::file::{load_unity_file, UnityFile};
use unity_asset_decode::object::UnityObject;
use unity_asset_decode::texture::Texture2DConverter;
use unity_asset_decode::texture::formats::TextureFormat;
use unity_asset_decode::texture::types::Texture2D;
use unity_asset_decode::unity_version::UnityVersion;

const BUNDLE_PATH: &str = r"C:\Program Files (x86)\Steam\steamapps\common\Last Epoch\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64\skill_icons_assets_all.bundle";
const ICON_OUT_DIR: &str = r"lebo\src-tauri\resources\icons\skills";
const MAP_OUT_PATH: &str = r"lebo\src-tauri\resources\icons\skill-icon-map.json";

/// GUID is 4 x u32 as stored in Unity's GUID type.
type Guid = [u32; 4];
/// (texture_path_id, x, y, width, height) — rect in atlas texture coords
type AtlasEntry = (i64, f32, f32, f32, f32);

fn main() -> unity_asset_decode::Result<()> {
    let extract = std::env::args().any(|a| a == "--extract");
    let debug = std::env::args().any(|a| a == "--debug");

    println!("Opening bundle: {BUNDLE_PATH}");
    let file = load_unity_file(BUNDLE_PATH)?;
    let bundle = match file {
        UnityFile::AssetBundle(b) => b,
        _ => { eprintln!("ERROR: Expected AssetBundle"); std::process::exit(1); }
    };
    println!("Bundle loaded. Nodes: {}", bundle.nodes.len());

    let ress_data = extract_ress_data(&bundle)?;
    println!("resS data: {} bytes", ress_data.len());

    let tex_converter = Texture2DConverter::new(UnityVersion::default());

    // Collect all objects in one pass
    let mut texture2d_objects: Vec<(i64, Texture2D)> = Vec::new();
    let mut sprite_objects: Vec<UnityObject> = Vec::new();
    let mut sprite_atlas_objects: Vec<UnityObject> = Vec::new();
    let mut type_counts: BTreeMap<i32, usize> = BTreeMap::new();

    for sf in &bundle.assets {
        for handle in sf.object_handles() {
            *type_counts.entry(handle.class_id()).or_default() += 1;
            match handle.class_id() {
                cid if cid == class_ids::TEXTURE_2D => {
                    let obj = handle.read()?;
                    let path_id = obj.path_id();
                    let mut tex = tex_converter.from_unity_object(&obj)?;
                    inject_stream_data(&mut tex, &ress_data);
                    texture2d_objects.push((path_id, tex));
                }
                cid if cid == class_ids::SPRITE => {
                    sprite_objects.push(handle.read()?);
                }
                cid if cid == class_ids::SPRITE_ATLAS => {
                    sprite_atlas_objects.push(handle.read()?);
                }
                _ => {}
            }
        }
    }

    println!("\nObject counts:");
    for (cid, cnt) in &type_counts {
        println!("  class_id={cid:>12}  count={cnt}");
    }
    println!("\nTexture2D: {}  Sprite: {}  SpriteAtlas: {}",
        texture2d_objects.len(), sprite_objects.len(), sprite_atlas_objects.len());

    // Probe: verify RGBA32 and BC7 decoding
    let probe_rgba = texture2d_objects.iter()
        .find(|(_, t)| matches!(t.format, TextureFormat::RGBA32 | TextureFormat::RGB24));
    if let Some((_, tex)) = probe_rgba {
        match decode_texture(tex) {
            Ok(png) if png.starts_with(b"\x89PNG") => {
                println!("GO probe (RGBA32): {:?} → {} bytes, valid PNG ✅", tex.name, png.len());
            }
            Ok(_) => println!("Probe: invalid PNG output ⚠️"),
            Err(e) => { eprintln!("NO-GO: probe failed: {e}"); std::process::exit(1); }
        }
    }

    let probe_bc7 = texture2d_objects.iter()
        .find(|(_, t)| t.format == TextureFormat::BC7 && !t.image_data.is_empty());
    if let Some((pid, tex)) = probe_bc7 {
        match decode_texture(tex) {
            Ok(png) if png.starts_with(b"\x89PNG") => {
                println!("GO probe (BC7 atlas): {:?} path_id={pid} → {} bytes, valid PNG ✅", tex.name, png.len());
            }
            Ok(_) => println!("BC7 probe: invalid PNG ⚠️"),
            Err(e) => println!("BC7 probe FAILED: {e} ⚠️"),
        }
    }

    // Build GUID → AtlasEntry map from all SpriteAtlas objects
    // m_RenderDataMap[i] = [[GUID_obj, local_id_i64], {texture, textureRect, ...}]
    let mut atlas_data: HashMap<Guid, AtlasEntry> = HashMap::new();
    let mut atlas_names: HashMap<i64, String> = HashMap::new(); // tex path_id → atlas name
    for atlas_obj in &sprite_atlas_objects {
        let props = atlas_obj.class.properties();
        let atlas_name = match props.get("m_Name") {
            Some(UnityValue::String(s)) => s.clone(),
            _ => "<unknown>".to_string(),
        };
        if let Some(UnityValue::Array(rdm)) = props.get("m_RenderDataMap") {
            for pair_val in rdm {
                if let UnityValue::Array(pair) = pair_val {
                    let key_guid = extract_guid_from_rdm_key(pair.first());
                    let entry = extract_atlas_entry(pair.get(1));
                    if let (Some(guid), Some(ae)) = (key_guid, entry) {
                        atlas_names.entry(ae.0).or_insert_with(|| atlas_name.clone());
                        atlas_data.insert(guid, ae);
                    }
                }
            }
        }
    }
    println!("Atlas render data entries: {}", atlas_data.len());

    // Probe: show first 5 sprites with atlas lookup
    println!("\n--- Sprite sample (first 5, atlas-resolved) ---");
    for obj in sprite_objects.iter().take(5) {
        let props = obj.class.properties();
        let name = get_str(props, "m_Name").unwrap_or_default();
        let guid = sprite_guid(props);
        let resolved = guid.and_then(|g| atlas_data.get(&g));
        if let Some((tex_pid, x, y, w, h)) = resolved {
            println!("  {:?}  atlas_tex_pid={tex_pid}  textureRect=({x:.0},{y:.0},{w:.0}x{h:.0})", name);
        } else {
            println!("  {:?}  GUID={guid:?}  → no atlas entry", name);
        }
    }

    if debug || !extract {
        // Debug: dump one full BC7 atlas and save one sprite with both y-formula variants
        let cwd = std::env::current_dir().unwrap_or_default();
        let first_bc7 = texture2d_objects.iter()
            .find(|(_, t)| t.format == TextureFormat::BC7 && !t.image_data.is_empty());
        if let Some((pid, atlas_tex)) = first_bc7 {
            if let Ok(atlas_img) = decode_to_rgba(atlas_tex) {
                let atlas_path = cwd.join("debug_atlas.png");
                if let Ok(png) = encode_png(&atlas_img) {
                    std::fs::write(&atlas_path, &png).ok();
                    println!("DEBUG: saved atlas {:?} ({}×{}) → {}", atlas_tex.name, atlas_img.width(), atlas_img.height(), atlas_path.display());
                }
                // Find first skillIcon sprite that resolves to this atlas
                for obj in &sprite_objects {
                    let props = obj.class.properties();
                    let name = get_str(props, "m_Name").unwrap_or_default();
                    if !name.starts_with("skillIcon-") { continue; }
                    let guid = match sprite_guid(props) { Some(g) => g, None => continue };
                    let entry = match atlas_data.get(&guid) { Some(e) => e, None => continue };
                    if entry.0 != *pid { continue; }
                    let (_, rx, ry, rw, rh) = *entry;
                    let ah = atlas_img.height() as f32;
                    println!("DEBUG sprite {:?}: textureRect=({rx:.0},{ry:.0},{rw:.0}×{rh:.0})  atlas_h={ah:.0}", name);
                    // Variant A: no flip (current fix)
                    let ya = ry.floor() as u32;
                    let xc = rx.floor() as u32;
                    let wc = rw.ceil() as u32;
                    let hc = rh.ceil() as u32;
                    if xc + wc <= atlas_img.width() && ya + hc <= atlas_img.height() {
                        let crop = image::imageops::crop_imm(&atlas_img, xc, ya, wc, hc).to_image();
                        if let Ok(png) = encode_png(&crop) {
                            let p = cwd.join("debug_sprite_noflip.png");
                            std::fs::write(&p, &png).ok();
                            println!("DEBUG: noflip crop → {} (y={})", p.display(), ya);
                        }
                    }
                    // Variant B: with flip
                    let yb = (ah - ry - rh).floor() as u32;
                    if xc + wc <= atlas_img.width() && yb + hc <= atlas_img.height() {
                        let crop = image::imageops::crop_imm(&atlas_img, xc, yb, wc, hc).to_image();
                        if let Ok(png) = encode_png(&crop) {
                            let p = cwd.join("debug_sprite_flip.png");
                            std::fs::write(&p, &png).ok();
                            println!("DEBUG: flip crop → {} (y={})", p.display(), yb);
                        }
                    }
                    break;
                }
            }
        }
        if !extract {
            println!("\nRun with --extract to export all skill icons.");
            return Ok(());
        }
    }

    // Task 7: Full extraction
    let project_root = std::env::current_dir()
        .map_err(|e| unity_asset_decode::BinaryError::generic(format!("cwd error: {e}")))?;
    let out_dir = project_root.join(ICON_OUT_DIR);
    std::fs::create_dir_all(&out_dir)
        .map_err(|e| unity_asset_decode::BinaryError::generic(format!("mkdir: {e}")))?;
    println!("\nOutput directory: {}", out_dir.display());

    // Decode all atlas textures into memory (keyed by path_id)
    let mut atlas_images: HashMap<i64, image::RgbaImage> = HashMap::new();
    for (path_id, tex) in &texture2d_objects {
        if tex.image_data.is_empty() { continue; }
        match decode_to_rgba(tex) {
            Ok(img) => { atlas_images.insert(*path_id, img); }
            Err(e) => eprintln!("  WARN: failed to decode {:?} (path_id={path_id}): {e}", tex.name),
        }
    }
    println!("Decoded {} images", atlas_images.len());

    let mut extracted = 0usize;
    let mut failed = 0usize;
    let mut extracted_names: Vec<String> = Vec::new();

    // Primary path: Sprite objects with atlas GUID lookup
    for obj in &sprite_objects {
        let props = obj.class.properties();
        let name = match get_str(props, "m_Name") {
            Some(n) => n,
            None => continue,
        };
        if !name.starts_with("skillIcon-") { continue; }

        let guid = match sprite_guid(props) {
            Some(g) => g,
            None => { eprintln!("  MISS: no GUID for {:?}", name); failed += 1; continue; }
        };

        let (tex_pid, rx, ry, rw, rh) = match atlas_data.get(&guid) {
            Some(e) => *e,
            None => { eprintln!("  MISS: no atlas entry for {:?} guid={:?}", name, guid); failed += 1; continue; }
        };

        let atlas_img = match atlas_images.get(&tex_pid) {
            Some(img) => img,
            None => { eprintln!("  MISS: atlas image not decoded tex_pid={tex_pid} for {:?}", name); failed += 1; continue; }
        };

        match crop_and_save(atlas_img, rx, ry, rw, rh, &name, &out_dir) {
            Ok(()) => { extracted += 1; extracted_names.push(name.clone()); }
            Err(e) => { eprintln!("  FAIL {:?}: {e}", name); failed += 1; }
        }
    }

    // Fallback: standalone skillIcon-* Texture2D not already extracted
    for (_, tex) in &texture2d_objects {
        if !tex.name.starts_with("skillIcon-") { continue; }
        if extracted_names.iter().any(|n| n == &tex.name) { continue; }

        match decode_texture(tex) {
            Ok(png_bytes) => {
                let out_path = out_dir.join(format!("{}.png", tex.name));
                if let Err(e) = std::fs::write(&out_path, &png_bytes) {
                    eprintln!("  FAIL write {:?}: {e}", tex.name);
                    failed += 1;
                } else {
                    extracted += 1;
                    extracted_names.push(tex.name.clone());
                }
            }
            Err(e) => { eprintln!("  FAIL decode {:?}: {e}", tex.name); failed += 1; }
        }
    }

    println!("\nExtracted: {extracted}  Failed: {failed}");

    // Task 8: Build skill-icon-map.json
    build_icon_map(&project_root, &out_dir)?;

    Ok(())
}

// --- Atlas data extraction helpers ---

fn extract_guid_from_rdm_key(key_val: Option<&UnityValue>) -> Option<Guid> {
    // key_val is Array: [GUID_obj, local_id_i64]
    let arr = match key_val { Some(UnityValue::Array(a)) => a, _ => return None };
    let guid_obj = match arr.first() { Some(UnityValue::Object(o)) => o, _ => return None };
    Some([
        guid_u32(guid_obj, "data[0]")?,
        guid_u32(guid_obj, "data[1]")?,
        guid_u32(guid_obj, "data[2]")?,
        guid_u32(guid_obj, "data[3]")?,
    ])
}

fn guid_u32(obj: &indexmap::IndexMap<String, UnityValue>, key: &str) -> Option<u32> {
    match obj.get(key) {
        Some(UnityValue::Integer(i)) => Some(*i as u32),
        _ => None,
    }
}

fn extract_atlas_entry(val: Option<&UnityValue>) -> Option<AtlasEntry> {
    let obj = match val { Some(UnityValue::Object(o)) => o, _ => return None };
    let tex_pid = match obj.get("texture") {
        Some(UnityValue::Object(t)) => match t.get("m_PathID") {
            Some(UnityValue::Integer(pid)) => *pid,
            _ => return None,
        },
        _ => return None,
    };
    let rect = match obj.get("textureRect") {
        Some(UnityValue::Object(r)) => r,
        _ => return None,
    };
    let x = get_f32(rect, "x")?;
    let y = get_f32(rect, "y")?;
    let w = get_f32(rect, "width")?;
    let h = get_f32(rect, "height")?;
    Some((tex_pid, x, y, w, h))
}

fn sprite_guid(props: &indexmap::IndexMap<String, UnityValue>) -> Option<Guid> {
    // m_RenderDataKey = Array: [GUID_obj, local_id]  OR  just [GUID_obj]
    let arr = match props.get("m_RenderDataKey") { Some(UnityValue::Array(a)) => a, _ => return None };
    let guid_obj = match arr.first() { Some(UnityValue::Object(o)) => o, _ => return None };
    Some([
        guid_u32(guid_obj, "data[0]")?,
        guid_u32(guid_obj, "data[1]")?,
        guid_u32(guid_obj, "data[2]")?,
        guid_u32(guid_obj, "data[3]")?,
    ])
}

fn get_str<'a>(map: &'a indexmap::IndexMap<String, UnityValue>, key: &str) -> Option<String> {
    match map.get(key) {
        Some(UnityValue::String(s)) => Some(s.clone()),
        _ => None,
    }
}

fn get_f32(map: &indexmap::IndexMap<String, UnityValue>, key: &str) -> Option<f32> {
    match map.get(key) {
        Some(UnityValue::Float(f)) => Some(*f as f32),
        Some(UnityValue::Integer(i)) => Some(*i as f32),
        _ => None,
    }
}

// --- Image operations ---

fn crop_and_save(
    atlas: &image::RgbaImage,
    rx: f32, ry: f32, rw: f32, rh: f32,
    name: &str,
    out_dir: &PathBuf,
) -> Result<(), String> {
    let atlas_h = atlas.height() as f32;
    let x = rx.floor() as u32;
    // Unity D3D bundles store pixel data bottom-up (row 0 = bottom of image).
    // textureRect.y is also Y-from-bottom, so they're in the same space — no flip needed.
    let y = ry.floor() as u32;
    let w = rw.ceil() as u32;
    let h = rh.ceil() as u32;

    if x + w > atlas.width() || y + h > atlas.height() {
        return Err(format!(
            "Rect ({x},{y},{w}x{h}) out of atlas bounds {}x{}",
            atlas.width(), atlas.height()
        ));
    }

    let cropped = image::imageops::crop_imm(atlas, x, y, w, h).to_image();
    let png = encode_png(&cropped)?;
    let safe_name = name.replace(['/', '\\', ':'], "_");
    std::fs::write(out_dir.join(format!("{safe_name}.png")), &png)
        .map_err(|e| format!("write: {e}"))
}

fn encode_png(img: &image::RgbaImage) -> Result<Vec<u8>, String> {
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encode: {e}"))?;
    Ok(buf.into_inner())
}

fn decode_to_rgba(tex: &Texture2D) -> Result<image::RgbaImage, String> {
    let w = tex.width as usize;
    let h = tex.height as usize;
    match tex.format {
        TextureFormat::BC7 => {
            let mut buf = vec![0u32; w * h];
            texture2ddecoder::decode_bc7(&tex.image_data, w, h, &mut buf)
                .map_err(|e| format!("BC7: {e}"))?;
            u32_to_rgba(buf, tex.width as u32, tex.height as u32)
        }
        TextureFormat::DXT5Crunched | TextureFormat::DXT1Crunched => {
            let mut buf = vec![0u32; w * h];
            texture2ddecoder::decode_crunch(&tex.image_data, w, h, &mut buf)
                .map_err(|e| format!("Crunch: {e}"))?;
            u32_to_rgba(buf, tex.width as u32, tex.height as u32)
        }
        TextureFormat::RGBA32 => {
            image::RgbaImage::from_raw(tex.width as u32, tex.height as u32, tex.image_data.clone())
                .ok_or_else(|| "RGBA32 from_raw failed".to_string())
        }
        TextureFormat::RGB24 => {
            let rgba: Vec<u8> = tex.image_data.chunks_exact(3)
                .flat_map(|c| [c[0], c[1], c[2], 255])
                .collect();
            image::RgbaImage::from_raw(tex.width as u32, tex.height as u32, rgba)
                .ok_or_else(|| "RGB24 from_raw failed".to_string())
        }
        fmt => {
            let converter = Texture2DConverter::new(UnityVersion::default());
            converter.decode_to_image(tex)
                .map_err(|e| format!("{fmt:?}: {e}"))
        }
    }
}

fn u32_to_rgba(buf: Vec<u32>, w: u32, h: u32) -> Result<image::RgbaImage, String> {
    // texture2ddecoder color() packs as u32::from_le_bytes([b, g, r, a])
    // so bit layout: bits 0-7=B, 8-15=G, 16-23=R, 24-31=A
    let rgba: Vec<u8> = buf.iter()
        .flat_map(|&p| {
            [((p >> 16) & 0xFF) as u8, ((p >> 8) & 0xFF) as u8,
             (p & 0xFF) as u8, ((p >> 24) & 0xFF) as u8]
        })
        .collect();
    image::RgbaImage::from_raw(w, h, rgba)
        .ok_or_else(|| "Failed to create RgbaImage".to_string())
}

fn decode_texture(tex: &Texture2D) -> Result<Vec<u8>, String> {
    if tex.image_data.is_empty() {
        return Err("No image data".to_string());
    }
    encode_png(&decode_to_rgba(tex)?)
}

fn inject_stream_data(tex: &mut Texture2D, ress_data: &[u8]) {
    if tex.image_data.is_empty() && tex.stream_info.size > 0 {
        let start = tex.stream_info.offset as usize;
        let end = start + tex.stream_info.size as usize;
        if end <= ress_data.len() {
            tex.image_data = ress_data[start..end].to_vec();
        }
    }
}

fn extract_ress_data(bundle: &AssetBundle) -> unity_asset_decode::Result<Vec<u8>> {
    if let Some(node) = bundle.nodes.iter().find(|n| n.name.ends_with(".resS")) {
        println!("resS node: {:?} ({} bytes)", node.name, node.size);
        return bundle.extract_node_data(node);
    }
    Err(unity_asset_decode::BinaryError::generic("No .resS found in bundle"))
}

// --- Task 8: skill-icon-map.json ---

fn build_icon_map(project_root: &PathBuf, icon_dir: &PathBuf) -> unity_asset_decode::Result<()> {
    let entries = std::fs::read_dir(icon_dir)
        .map_err(|e| unity_asset_decode::BinaryError::generic(format!("read_dir: {e}")))?;

    let mut bundle_names: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.ends_with(".png") { Some(name) } else { None }
        })
        .collect();
    bundle_names.sort();

    println!("\nBuilding skill-icon-map.json from {} extracted icons...", bundle_names.len());

    let skill_ids = collect_skill_ids(project_root);
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    for skill_id in &skill_ids {
        if let Some(matched) = find_bundle_name(skill_id, &bundle_names) {
            map.insert(skill_id.clone(), matched);
        }
    }

    let map_path = project_root.join(MAP_OUT_PATH);
    if let Some(parent) = map_path.parent() { std::fs::create_dir_all(parent).ok(); }

    let json = serde_json::to_string_pretty(&map)
        .map_err(|e| unity_asset_decode::BinaryError::generic(format!("JSON: {e}")))?;
    std::fs::write(&map_path, json)
        .map_err(|e| unity_asset_decode::BinaryError::generic(format!("write map: {e}")))?;

    println!("Mapped {}/{} skill IDs", map.len(), skill_ids.len());
    println!("Map at: {}", map_path.display());

    let unmapped: Vec<&String> = skill_ids.iter().filter(|id| !map.contains_key(*id)).collect();
    if !unmapped.is_empty() && unmapped.len() <= 20 {
        println!("Unmapped ({}):", unmapped.len());
        for id in &unmapped { println!("  {id}"); }
    } else if !unmapped.is_empty() {
        println!("Unmapped: {} (first few: {:?})", unmapped.len(), &unmapped[..5]);
    }
    Ok(())
}

fn collect_skill_ids(project_root: &PathBuf) -> Vec<String> {
    // Game data is at lebo/src-tauri/resources/game-data/classes/*.json
    // Each file has { "skills": [{ "id": "acolyte-rip-blood", ... }] }
    let classes_dir = project_root.join("lebo/src-tauri/resources/game-data/classes");
    let mut ids: Vec<String> = Vec::new();
    let Ok(entries) = std::fs::read_dir(&classes_dir) else { return ids };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) else { continue };
        // skills[].id
        if let Some(skills) = val.get("skills").and_then(|v| v.as_array()) {
            for skill in skills {
                if let Some(id) = skill.get("id").and_then(|v| v.as_str()) {
                    ids.push(id.to_string());
                }
            }
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

fn extract_skill_ids_from_value(_val: &serde_json::Value, _out: &mut Vec<String>) {
    // unused — kept for API compat
}

fn find_bundle_name(skill_id: &str, bundle_names: &[String]) -> Option<String> {
    // skill_id = "acolyte-rip-blood" → try variants:
    // 1. "skillIcon-rip blood.png" (drop class prefix, replace - with space)
    // 2. "skillIcon-Rip Blood.png" (title case)
    // 3. "skillIcon-rip-blood.png" (keep hyphens)
    // All matched case-insensitively.

    let lower_names: Vec<String> = bundle_names.iter().map(|n| n.to_lowercase()).collect();

    // Strip class prefix (first hyphen-separated segment)
    let without_prefix = skill_id.splitn(2, '-').nth(1).unwrap_or(skill_id);

    let candidates = [
        format!("skillicon-{}.png", without_prefix.replace('-', " ")),
        format!("skillicon-{}.png", without_prefix),
    ];

    for candidate in &candidates {
        if let Some(idx) = lower_names.iter().position(|n| n == candidate) {
            return Some(bundle_names[idx].clone());
        }
    }

    None
}
