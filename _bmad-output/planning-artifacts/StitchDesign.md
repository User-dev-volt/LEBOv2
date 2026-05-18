<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Void Architect - Build Optimizer</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&amp;family=Manrope:wght@400;500;700&amp;family=Newsreader:ital,wght@0,400;1,400&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "surface-container-high": "#2a2a2c",
                      "on-tertiary-fixed-variant": "#544600",
                      "tertiary-fixed-dim": "#e9c400",
                      "on-primary-fixed-variant": "#004f54",
                      "on-primary-container": "#aef8ff",
                      "on-surface-variant": "#d1c1d9",
                      "on-tertiary": "#3a3000",
                      "outline": "#9a8ca2",
                      "surface": "#131315",
                      "on-surface": "#e5e1e4",
                      "surface-variant": "#353437",
                      "on-tertiary-fixed": "#221b00",
                      "primary-fixed": "#7df4ff",
                      "inverse-surface": "#e5e1e4",
                      "surface-tint": "#00dbe9",
                      "on-secondary-container": "#480063",
                      "error-container": "#93000a",
                      "on-background": "#e5e1e4",
                      "on-primary": "#00363a",
                      "on-error": "#690005",
                      "inverse-primary": "#006970",
                      "tertiary-fixed": "#ffe16d",
                      "surface-bright": "#39393b",
                      "on-secondary-fixed-variant": "#75009e",
                      "secondary-container": "#d05bff",
                      "on-error-container": "#ffdad6",
                      "inverse-on-surface": "#313032",
                      "on-tertiary-container": "#4c3e00",
                      "surface-container-highest": "#353437",
                      "on-secondary": "#520070",
                      "secondary-fixed": "#f9d8ff",
                      "error": "#ffb4ab",
                      "primary-container": "#00767d",
                      "background": "#131315",
                      "surface-container-low": "#1c1b1e",
                      "secondary-fixed-dim": "#ecb1ff",
                      "surface-container-lowest": "#0e0e10",
                      "primary": "#00dbe9",
                      "secondary": "#ecb1ff",
                      "primary-fixed-dim": "#00dbe9",
                      "tertiary-container": "#c9a900",
                      "surface-dim": "#131315",
                      "tertiary": "#e9c400",
                      "outline-variant": "#4e4356",
                      "on-primary-fixed": "#002022",
                      "surface-container": "#201f22",
                      "on-secondary-fixed": "#320046"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {},
              "fontFamily": {
                      "headline": [
                              "Space Grotesk"
                      ],
                      "body": [
                              "Manrope"
                      ],
                      "label": [
                              "Newsreader"
                      ]
              }
      },
          },
        }
      </script>
</head>
<body class="bg-surface text-on-surface font-body min-h-screen overflow-x-hidden selection:bg-primary selection:text-on-primary">
<!-- TopNavBar (Shared Component) -->
<header class="fixed top-0 w-full z-50 bg-[#131315]/80 backdrop-blur-xl bg-gradient-to-b from-[#131315] to-transparent shadow-[0_0_30px_rgba(236,177,255,0.05)] flex justify-between items-center px-12 h-16 w-full font-['Space_Grotesk'] tracking-wider uppercase text-sm">
<div class="flex items-center gap-12">
<div class="font-['Space_Grotesk'] text-2xl font-bold tracking-tighter text-[#9D00FF]">VOID_ARCHITECT</div>
<nav class="hidden md:flex gap-8 h-full items-center">
<a class="text-[#e5e1e4]/60 hover:text-[#e5e1e4] hover:bg-[#131315]/40 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer flex-col h-full flex justify-center mt-1" href="#">Passive Tree</a>
<a class="text-[#9D00FF] border-b-2 border-[#9D00FF] pb-1 hover:bg-[#131315]/40 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer flex-col h-full flex justify-center mt-1" href="#">Skills</a>
<a class="text-[#e5e1e4]/60 hover:text-[#e5e1e4] hover:bg-[#131315]/40 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer flex-col h-full flex justify-center mt-1" href="#">Timelines</a>
</nav>
</div>
<div class="flex items-center gap-4 text-purple-500">
<span class="material-symbols-outlined hover:bg-[#131315]/40 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer p-2 rounded">settings</span>
<span class="material-symbols-outlined hover:bg-[#131315]/40 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer p-2 rounded">account_circle</span>
</div>
</header>
<!-- SideNavBar (Shared Component) -->
<aside class="fixed left-0 top-16 h-[calc(100vh-4rem)] w-20 hover:w-64 transition-all duration-500 z-40 bg-[#131315] flex flex-col py-6 gap-8 overflow-hidden group bg-[#1c1c1e] font-['Manrope'] text-xs uppercase font-medium">
<div class="px-6 flex items-center gap-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
<div class="w-8 h-8 rounded-full bg-[#9D00FF]/20 border border-[#9D00FF] flex items-center justify-center text-[#9D00FF]">
<span class="material-symbols-outlined text-sm">person</span>
</div>
<div>
<div class="font-['Space_Grotesk'] font-black text-[#9D00FF] text-sm">ARCHITECT_01</div>
<div class="text-[#e5e1e4]/40 text-[10px]">Void Weaver Level 99</div>
</div>
</div>
<nav class="flex flex-col gap-2 w-full">
<a class="flex items-center px-6 py-3 gap-4 bg-gradient-to-r from-[#9D00FF]/20 to-transparent border-l-4 border-[#9D00FF] text-[#9D00FF] hover:bg-white/5 transition-colors group-hover:translate-x-1 duration-200" href="#">
<span class="material-symbols-outlined flex-shrink-0">analytics</span>
<span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Optimizer</span>
</a>
<a class="flex items-center px-6 py-3 gap-4 border-l-4 border-transparent text-[#e5e1e4]/40 hover:text-[#e5e1e4] hover:bg-white/5 transition-colors group-hover:translate-x-1 duration-200" href="#">
<span class="material-symbols-outlined flex-shrink-0">auto_stories</span>
<span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Grimoire</span>
</a>
<a class="flex items-center px-6 py-3 gap-4 border-l-4 border-transparent text-[#e5e1e4]/40 hover:text-[#e5e1e4] hover:bg-white/5 transition-colors group-hover:translate-x-1 duration-200" href="#">
<span class="material-symbols-outlined flex-shrink-0">explore</span>
<span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Void Maps</span>
</a>
<a class="flex items-center px-6 py-3 gap-4 border-l-4 border-transparent text-[#e5e1e4]/40 hover:text-[#e5e1e4] hover:bg-white/5 transition-colors group-hover:translate-x-1 duration-200" href="#">
<span class="material-symbols-outlined flex-shrink-0">inventory_2</span>
<span class="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Archive</span>
</a>
</nav>
<div class="mt-auto px-4 w-full">
<button class="w-full py-3 bg-[#9D00FF]/10 text-[#9D00FF] border border-[#9D00FF]/30 rounded-sm hover:bg-[#9D00FF]/20 transition-all opacity-0 group-hover:opacity-100 whitespace-nowrap">
                FORGE BUILD
            </button>
</div>
</aside>
<!-- Main Canvas -->
<main class="pt-24 pl-28 pr-8 pb-12 w-full min-h-screen flex flex-col gap-8">
<!-- Top Split Section -->
<div class="flex flex-col xl:flex-row gap-8 items-stretch">
<!-- Left: Skill Tree Canvas (65%) -->
<section class="xl:w-[65%] bg-surface-container-low rounded-DEFAULT relative overflow-hidden flex flex-col min-h-[600px] shadow-[inset_0_0_100px_rgba(0,219,233,0.03)]">
<!-- Abstract Void Texture / Blur -->
<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-surface-container-low to-surface-container-low opacity-50 pointer-events-none"></div>
<div class="p-6 z-10 flex justify-between items-start">
<div>
<h1 class="font-headline text-4xl font-bold text-on-surface tracking-tighter">Erasing Strike</h1>
<p class="font-label text-primary mt-1 italic text-lg">Void Cleave Anomaly Sequence</p>
</div>
<div class="flex gap-2">
<div class="px-3 py-1 border border-outline-variant/30 rounded-sm font-body text-xs text-secondary flex items-center gap-2 bg-surface-container-highest/50 backdrop-blur-md">
<div class="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_5px_var(--tw-colors-secondary)]"></div>
                            VOID DAMAGE
                        </div>
<div class="px-3 py-1 border border-outline-variant/30 rounded-sm font-body text-xs text-on-surface-variant flex items-center gap-2 bg-surface-container-highest/50 backdrop-blur-md">
                            MELEE
                        </div>
</div>
</div>
<!-- Ritual Node Canvas (Simulated) -->
<div class="flex-grow relative w-full h-full flex items-center justify-center p-12 z-10">
<!-- Connections (SVG Paths simulated with divs for layout ease, in real app would be SVG) -->
<div class="absolute w-[200px] h-[2px] bg-primary/30 top-1/2 left-1/2 -translate-y-1/2 -translate-x-full origin-right rotate-[15deg]"></div>
<div class="absolute w-[150px] h-[2px] bg-outline-variant/30 top-1/2 left-1/2 -translate-y-1/2 origin-left rotate-[-25deg]"></div>
<div class="absolute w-[180px] h-[2px] bg-primary/30 top-1/2 left-1/2 -translate-y-1/2 origin-left rotate-[45deg]"></div>
<!-- Center Node (Active) -->
<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-none rotate-45 flex items-center justify-center shadow-[0_0_30px_rgba(0,219,233,0.3)] cursor-pointer hover:scale-110 transition-transform">
<span class="material-symbols-outlined -rotate-45 text-on-primary" data-icon="swords">swords</span>
</div>
<!-- Surrounding Nodes -->
<!-- Active Node Top Left -->
<div class="absolute top-[35%] left-[30%] w-12 h-12 bg-surface-container border border-primary text-primary rounded-none rotate-45 flex items-center justify-center shadow-[0_0_15px_rgba(0,219,233,0.1)] cursor-pointer hover:bg-primary/10 transition-colors">
<div class="-rotate-45 text-xs font-headline font-bold">3/3</div>
</div>
<!-- Inactive Node Bottom Right -->
<div class="absolute top-[65%] left-[70%] w-10 h-10 bg-surface-container-lowest border border-outline-variant/50 text-on-surface-variant rounded-none rotate-45 flex items-center justify-center cursor-pointer hover:border-outline-variant transition-colors">
<div class="-rotate-45 text-xs font-headline opacity-50">0/1</div>
</div>
<!-- Active Node Top Right -->
<div class="absolute top-[25%] left-[65%] w-12 h-12 bg-gradient-to-br from-secondary/80 to-secondary-container/80 rounded-none rotate-45 flex items-center justify-center shadow-[0_0_20px_rgba(236,177,255,0.2)] cursor-pointer hover:scale-110 transition-transform">
<span class="material-symbols-outlined -rotate-45 text-on-secondary text-sm" data-icon="bolt">bolt</span>
</div>
</div>
</section>
<!-- Right: Stat Panel (35%) -->
<aside class="xl:w-[35%] flex flex-col gap-6">
<!-- DPS Module -->
<div class="bg-surface-container-low rounded-DEFAULT p-6 flex flex-col gap-4 relative overflow-hidden group hover:bg-surface-container-highest transition-colors duration-300">
<div class="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
<div class="font-label text-on-surface-variant text-sm uppercase tracking-widest border-b border-outline-variant/10 pb-2">Effective DPS</div>
<div class="font-headline text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary to-primary-container tracking-tighter">
                        428.5<span class="text-2xl text-primary/70">k</span>
</div>
<div class="grid grid-cols-2 gap-4 mt-2">
<div>
<div class="font-label text-xs text-on-surface-variant">Crit Chance</div>
<div class="font-body text-secondary text-lg">84.2%</div>
</div>
<div>
<div class="font-label text-xs text-on-surface-variant">Attack Speed</div>
<div class="font-body text-on-surface text-lg">1.4s</div>
</div>
</div>
</div>
<!-- Survivability Module -->
<div class="bg-surface-container-low rounded-DEFAULT p-6 flex flex-col gap-5">
<div class="font-label text-on-surface-variant text-sm uppercase tracking-widest border-b border-outline-variant/10 pb-2">Defense Matrix</div>
<div class="flex flex-col gap-3">
<div class="flex justify-between items-end">
<div class="font-body text-sm text-on-surface">Health</div>
<div class="font-headline text-lg text-error">1,204</div>
</div>
<div class="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
<div class="h-full bg-error w-[40%]"></div>
</div>
<div class="flex justify-between items-end mt-2">
<div class="font-body text-sm text-on-surface">Ward Retention</div>
<div class="font-headline text-lg text-primary">8,450</div>
</div>
<div class="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
<div class="h-full bg-gradient-to-r from-primary to-primary-container w-[85%]"></div>
</div>
</div>
</div>
<!-- Resistances Module -->
<div class="bg-surface-container-low rounded-DEFAULT p-6 flex-grow flex flex-col gap-4">
<div class="font-label text-on-surface-variant text-sm uppercase tracking-widest border-b border-outline-variant/10 pb-2">Elemental Resistances</div>
<div class="flex flex-col gap-4 mt-2">
<!-- Fire -->
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-error text-xl" data-icon="local_fire_department">local_fire_department</span>
<div class="flex-grow h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div class="h-full bg-error w-[75%]"></div>
</div>
<span class="font-headline text-sm w-10 text-right text-on-surface">75%</span>
</div>
<!-- Void -->
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-secondary text-xl" data-icon="dark_mode">dark_mode</span>
<div class="flex-grow h-1.5 bg-surface-container-highest rounded-full overflow-hidden relative">
<div class="h-full bg-secondary w-[100%]"></div>
<div class="absolute right-0 top-0 h-full w-2 bg-tertiary"></div> <!-- Overcap indicator -->
</div>
<span class="font-headline text-sm w-10 text-right text-secondary">112%</span>
</div>
<!-- Necrotic -->
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-primary-fixed text-xl" data-icon="skull">skull</span>
<div class="flex-grow h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div class="h-full bg-primary-fixed w-[68%]"></div>
</div>
<span class="font-headline text-sm w-10 text-right text-error">68%</span>
</div>
</div>
</div>
</aside>
</div>
<!-- Bottom Layout: Gear & Idols -->
<div class="flex flex-col xl:flex-row gap-8">
<!-- Gear Section -->
<section class="xl:w-[60%] bg-surface-container-lowest rounded-DEFAULT p-6 border border-outline-variant/10 relative">
<div class="font-label text-on-surface-variant text-sm uppercase tracking-widest mb-6 absolute top-6 left-6 opacity-50">Equipment Manifest</div>
<div class="grid grid-cols-5 gap-4 mt-8">
<!-- Standard Slots -->
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="apparel">apparel</span>
<span class="font-label text-[10px] text-outline-variant">HEAD</span>
</div>
<div class="aspect-square bg-surface-container border border-secondary/30 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer relative overflow-hidden group">
<div class="absolute inset-0 bg-secondary/5 group-hover:bg-secondary/10 transition-colors"></div>
<span class="material-symbols-outlined text-secondary" data-icon="shield">shield</span>
<span class="font-label text-[10px] text-secondary">CHEST</span>
</div>
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="front_hand">front_hand</span>
<span class="font-label text-[10px] text-outline-variant">HANDS</span>
</div>
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="footprint">footprint</span>
<span class="font-label text-[10px] text-outline-variant">BOOTS</span>
</div>
<div class="aspect-square bg-surface-container border border-tertiary/30 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer relative overflow-hidden group">
<div class="absolute inset-0 bg-tertiary/5 group-hover:bg-tertiary/10 transition-colors"></div>
<span class="material-symbols-outlined text-tertiary" data-icon="swords">swords</span>
<span class="font-label text-[10px] text-tertiary">WEAPON</span>
</div>
<!-- Row 2 -->
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="diamond">diamond</span>
<span class="font-label text-[10px] text-outline-variant">AMULET</span>
</div>
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="radio_button_unchecked">radio_button_unchecked</span>
<span class="font-label text-[10px] text-outline-variant">RING 1</span>
</div>
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="radio_button_unchecked">radio_button_unchecked</span>
<span class="font-label text-[10px] text-outline-variant">RING 2</span>
</div>
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="hourglass_empty">hourglass_empty</span>
<span class="font-label text-[10px] text-outline-variant">RELIC</span>
</div>
<div class="aspect-square bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors cursor-pointer group">
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="menu_book">menu_book</span>
<span class="font-label text-[10px] text-outline-variant">OFF-HAND</span>
</div>
</div>
</section>
<!-- Idol Grid Section -->
<section class="xl:w-[40%] bg-surface-container-lowest rounded-DEFAULT p-6 border border-outline-variant/10">
<div class="font-label text-on-surface-variant text-sm uppercase tracking-widest mb-6 opacity-50 flex justify-between items-center">
<span>Idol Matrix</span>
<span class="text-primary font-body text-xs lowercase">4x4</span>
</div>
<div class="grid grid-cols-4 grid-rows-4 gap-1 bg-surface-container-high p-1 w-fit mx-auto border border-outline-variant/30">
<!-- 1x1 Empty -->
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
<!-- 1x3 Idol (Vertical) -->
<div class="w-12 h-36 bg-primary/10 border border-primary/50 row-span-3 flex items-center justify-center">
<span class="material-symbols-outlined text-primary/50 text-sm rotate-90" data-icon="view_timeline">view_timeline</span>
</div>
<!-- 2x1 Idol (Horizontal) -->
<div class="w-24 h-12 bg-secondary/10 border border-secondary/50 col-span-2 flex items-center justify-center">
<span class="material-symbols-outlined text-secondary/50 text-sm" data-icon="horizontal_rule">horizontal_rule</span>
</div>
<!-- Row 2 Fill -->
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
<!-- 2x2 Idol -->
<div class="w-24 h-24 bg-tertiary/10 border border-tertiary/50 col-span-2 row-span-2 flex items-center justify-center">
<span class="material-symbols-outlined text-tertiary/50 text-xl" data-icon="grid_view">grid_view</span>
</div>
<!-- Row 3 Fill -->
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
<!-- Row 4 Fill -->
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
<div class="w-12 h-12 bg-surface border border-outline-variant/10"></div>
</div>
</section>
</div>
</main>
</body></html>