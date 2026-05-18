use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BuildMeta {
    pub id: String,
    pub name: String,
    pub class_id: String,
    pub mastery_id: String,
    pub created_at: String,
    pub updated_at: String,
}
