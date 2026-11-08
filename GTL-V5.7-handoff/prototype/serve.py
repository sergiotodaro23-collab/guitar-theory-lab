import http.server, json, os, functools
D=os.path.dirname(os.path.abspath(__file__)); P=os.path.join(D,'project'); AS=os.path.join(D,'..','assets')
M={v:k for k,v in json.load(open(os.path.join(D,'src','assets.json'))).items()}
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith('/_blob/'):
            i=path.split('/')[2].split('?')[0]
            return os.path.join(AS,M.get(i,'missing'))
        return super().translate_path(path)
    def log_message(self,*a): pass
http.server.ThreadingHTTPServer(('',8766),functools.partial(H,directory=P)).serve_forever()
