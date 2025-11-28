use abi_stable::{
    export_root_module, prefix_type::PrefixTypeTrait, sabi_extern_fn,
    sabi_trait::TD_Opaque, std_types::RBox, std_types::RString, std_types::RVec,
};
use phoenix_core::plugin::traits::{Plugin, PluginRef, PluginPrefix};
use std::collections::HashMap;

struct VoicePlugin;

impl Plugin for VoicePlugin {
    fn name(&self) -> String {
        "Voice".to_string()
    }

    fn version(&self) -> String {
        "0.1.0".to_string()
    }

    fn on_query(&self, query: String, _context: HashMap<String, String>) -> String {
        if query.to_lowercase().contains("voice") || query.to_lowercase().contains("speak") {
            format!("Voice plugin: Processing voice-related query: {}", query)
        } else {
            String::new()
        }
    }

    fn shutdown(&mut self) {
        println!("Voice plugin shutting down");
    }
}

#[sabi_extern_fn]
pub fn get_plugin() -> PluginRef {
    PluginRef::from_value(
        PluginPrefix {
            name: || RString::from("Voice"),
            version: || RString::from("0.1.0"),
            init: || RBox::new(VoicePlugin),
            on_query: |handle, query, context| {
                let mut ctx_map = HashMap::new();
                for (k, v) in context.iter() {
                    ctx_map.insert(k.as_str().to_string(), v.as_str().to_string());
                }
                RString::from(handle.on_query(query.as_str().to_string(), ctx_map))
            },
            shutdown: |handle| {
                let mut h = handle;
                h.shutdown();
            },
        },
        TD_Opaque,
    )
}
