#!/usr/bin/env python3
"""
Script para limpiar el caché del navegador automáticamente
Soporta Chrome, Firefox y Edge
"""

import os
import shutil
import sys
from pathlib import Path

def limpiar_chrome():
    """Limpiar caché de Chrome"""
    print("[Chrome] Limpiando caché...")
    
    cache_paths = [
        Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "User Data" / "Default" / "Cache",
        Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "User Data" / "Default" / "Code Cache",
    ]
    
    for path in cache_paths:
        if path.exists():
            try:
                shutil.rmtree(path)
                print(f"  ✅ Eliminado: {path}")
            except Exception as e:
                print(f"  ⚠️ Error: {e}")
        else:
            print(f"  ℹ️ No encontrado: {path}")

def limpiar_firefox():
    """Limpiar caché de Firefox"""
    print("[Firefox] Limpiando caché...")
    
    cache_path = Path.home() / "AppData" / "Local" / "Mozilla" / "Firefox" / "Profiles"
    
    if cache_path.exists():
        for profile in cache_path.glob("*"):
            cache_dir = profile / "cache2"
            if cache_dir.exists():
                try:
                    shutil.rmtree(cache_dir)
                    print(f"  ✅ Eliminado: {cache_dir}")
                except Exception as e:
                    print(f"  ⚠️ Error: {e}")
    else:
        print(f"  ℹ️ No encontrado: {cache_path}")

def limpiar_edge():
    """Limpiar caché de Edge"""
    print("[Edge] Limpiando caché...")
    
    cache_paths = [
        Path.home() / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data" / "Default" / "Cache",
        Path.home() / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data" / "Default" / "Code Cache",
    ]
    
    for path in cache_paths:
        if path.exists():
            try:
                shutil.rmtree(path)
                print(f"  ✅ Eliminado: {path}")
            except Exception as e:
                print(f"  ⚠️ Error: {e}")
        else:
            print(f"  ℹ️ No encontrado: {path}")

def main():
    print("\n" + "="*60)
    print("  LIMPIAR CACHÉ DEL NAVEGADOR")
    print("="*60 + "\n")
    
    print("⚠️  IMPORTANTE: Cierra todos los navegadores antes de continuar\n")
    
    input("Presiona ENTER para continuar...")
    
    print("\n" + "-"*60)
    limpiar_chrome()
    print("-"*60)
    limpiar_firefox()
    print("-"*60)
    limpiar_edge()
    print("-"*60 + "\n")
    
    print("✅ Caché limpiado exitosamente!\n")
    print("Próximos pasos:")
    print("1. Abre el navegador")
    print("2. Ve a: http://127.0.0.1:8765")
    print("3. Presiona Ctrl+F5 para forzar recarga")
    print("4. ¡Deberías ver los cambios!\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperación cancelada por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
