import py_compile, sys
try:
    py_compile.compile('scrcpy_raw_streamer.py', doraise=True)
    print('scrcpy_raw_streamer.py: OK')
    py_compile.compile('scrcpy_raw_ws_server.py', doraise=True)
    print('scrcpy_raw_ws_server.py: OK')
except py_compile.PyCompileError as e:
    print('ERROR:', e)
    sys.exit(1)
