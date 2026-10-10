// Evita una consola de Windows extra en modo release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    steam_keys_lib::run()
}