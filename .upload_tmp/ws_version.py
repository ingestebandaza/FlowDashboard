import websockets
print('websockets version:', websockets.__version__)
import inspect
print('serve sig:', inspect.signature(websockets.serve))
