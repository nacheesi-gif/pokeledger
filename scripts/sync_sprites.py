# Build-time tool only: Python + Pillow, no app dependencies or scheduled jobs.
# PokeAPI/sprites CC0 repository; image copyright The Pokemon Company.
# Source: https://github.com/PokeAPI/sprites
import urllib.request,concurrent.futures,io,json,pathlib,tempfile
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
cache=pathlib.Path(tempfile.gettempdir())/'pokeledger-gen3-source';cache.mkdir(exist_ok=True)
sha='c0542f7c51215d9672439012838c99f520596cbd'
def get(i):
 p=cache/f'{i}.png'
 for attempt in range(3):
  try:
   if not p.exists():p.write_bytes(urllib.request.urlopen(f'https://raw.githubusercontent.com/PokeAPI/sprites/{sha}/sprites/pokemon/versions/generation-iii/icons/{i}.png',timeout=20).read())
   im=Image.open(p).convert('RGBA');assert im.size==(32,32),(i,im.size);return i,im
  except Exception:
   if attempt==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:icons=list(ex.map(get,range(1,387)))
atlas=Image.new('RGBA',(32*20,32*20))
for i,im in icons:atlas.paste(im,(((i-1)%20)*32,((i-1)//20)*32))
atlas.save(root/'sprites-gen3.png',optimize=True)
print('SPRITES',len(icons),'BYTES',(root/'sprites-gen3.png').stat().st_size)
