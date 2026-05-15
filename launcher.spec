# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('wsapi_demo.html', '.'),
        ('wsapi.js', '.'),
        ('Login.js', '.'),
        ('logo.png', '.'),
        ('flow_agent_apk/build/flowagent-debug.apk', 'flow_agent_apk/build'),
    ],
    hiddenimports=['local_adb_server', 'updater'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='FlowDashboard',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
