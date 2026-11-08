import os
d=os.path.dirname(os.path.abspath(__file__))
def r(n): return open(os.path.join(d,n)).read()
head='''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Fretboard Lab — Studio</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/guitar-theory-lab/tokens.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>
'''
mid='''</style>
</helmet>
'''
props='''<script type="text/x-dc" data-dc-script data-props='{"bpm":{"editor":"range","default":100,"min":40,"max":240,"step":1,"section":"Transport"},"labelMode":{"editor":"enum","default":"note","options":["note","grade","function","finger","interval","none"],"section":"Tastiera"},"sound":{"editor":"boolean","default":true,"section":"Transport"},"$preview":{"width":1600,"height":1000}}'>
'''
out=head+r('css_v4.css')+'\n'+r('css_new.css')+'\n'+r('css_dev.css')+mid+r('tpl.html')+'</x-dc>\n'+props+r('consts_v4.js')+r('script_comp.js')+'</script>\n</body>\n</html>\n'
import json
A=json.load(open(os.path.join(d,'assets.json')))
for k,v in A.items(): out=out.replace('assets/'+k,'/_blob/'+v)
assert 'assets/' not in out, [l for l in out.split('\n') if 'assets/' in l][:3]
dst=os.path.join(d,'..','project','Main.dc.html')
open(dst,'w').write(out)
print(len(out))
