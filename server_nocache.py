#!/usr/bin/env python3
import http.server, socketserver
PORT = 8083

class NCH(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

httpd = socketserver.TCPServer(("", PORT), NCH)
print(f"nocache server on :{PORT}")
httpd.serve_forever()
