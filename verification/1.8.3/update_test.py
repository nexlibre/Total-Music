import os, subprocess, time, json, wave, math, struct, hashlib
from pathlib import Path
ADB=os.environ['ADB']; SERIAL=os.environ['SERIAL']; PKG='org.nexlibre.totalmusic'
def adb(*args,check=True,timeout=180):
    r=subprocess.run([ADB,'-s',SERIAL,*args],capture_output=True,text=True,timeout=timeout)
    print('adb',*args,':',r.stdout.strip(),r.stderr.strip(),flush=True)
    if check and r.returncode: raise RuntimeError('ADB command failed')
    return r.stdout.strip()
adb('root');time.sleep(3);adb('wait-for-device')
adb('install','private/signing/Total-Music-1.8.1-universal(2).apk',timeout=300)
adb('shell','monkey','-p',PKG,'1');time.sleep(20)
adb('shell','am','force-stop',PKG)
base='/data/user/0/'+PKG
uid=adb('shell','stat','-c','%u',base)
assert uid.isdigit()
seed=Path('private/update-seed');seed.mkdir(exist_ok=True)
with wave.open(str(seed/'continuity.wav'),'wb') as w:
 w.setparams((1,2,44100,0,'NONE','not compressed'))
 w.writeframes(b''.join(struct.pack('<h',int(3000*math.sin(2*math.pi*440*i/44100))) for i in range(44100*3)))
adb('push',str(seed/'continuity.wav'),'/sdcard/Music/continuity.wav')
uri='file:///sdcard/Music/continuity.wav'; song={'id':'continuity-song','title':'Continuity verification','artist':'Total Music test','uri':uri,'path':'/sdcard/Music/continuity.wav','duration':'0:03','format':'wav'}
playlist=json.dumps([{'id':'continuity-playlist','name':'Update preservation','songs':[song],'sort':'MANUAL','addedUris':[uri]}])
(seed/'star-device-playlists.json').write_text(playlist)
(seed/'total-music-favorites.xml').write_text('<?xml version="1.0" encoding="utf-8"?><map><string name="continuity-song">LIKE</string><string name="removed-song">INDIFFERENT</string></map>')
(seed/'bitchord_settings.xml').write_text('<?xml version="1.0" encoding="utf-8"?><map><string name="player_visual_style">GOOGLE_EXPRESSIVE_PLUS</string><boolean name="google_expressive" value="true"/><boolean name="google_artwork_colors" value="true"/></map>')
for name,folder in [('star-device-playlists.json','files'),('total-music-favorites.xml','shared_prefs'),('bitchord_settings.xml','shared_prefs')]:
 adb('shell','mkdir','-p',base+'/'+folder)
 adb('push',str(seed/name),base+'/'+folder+'/'+name)
 adb('shell','chown',uid+':'+uid,base+'/'+folder,base+'/'+folder+'/'+name)
 adb('shell','chmod','660',base+'/'+folder+'/'+name)
adb('shell','restorecon','-RF',base)
def read(name,folder): return adb('shell','cat',base+'/'+folder+'/'+name)
before={name:read(name,folder) for name,folder in [('star-device-playlists.json','files'),('total-music-favorites.xml','shared_prefs'),('bitchord_settings.xml','shared_prefs')]}
audio_before=adb('shell','sha256sum','/sdcard/Music/continuity.wav')
adb('install','-r','delivery/Total-Music-1.8.3-release-signed.apk',timeout=300)
for name,folder in [('star-device-playlists.json','files'),('total-music-favorites.xml','shared_prefs'),('bitchord_settings.xml','shared_prefs')]: assert read(name,folder)==before[name],name+' changed during update'
adb('shell','monkey','-p',PKG,'1');time.sleep(30)
assert adb('shell','pidof',PKG), 'app did not remain running'
adb('shell','am','force-stop',PKG)
assert json.loads(read('star-device-playlists.json','files'))==json.loads(playlist)
favorites=read('total-music-favorites.xml','shared_prefs');assert 'continuity-song' in favorites and 'LIKE' in favorites and 'removed-song' in favorites
settings=read('bitchord_settings.xml','shared_prefs');assert 'GOOGLE_EXPRESSIVE_PLUS' in settings and 'google_artwork_colors' in settings
assert adb('shell','sha256sum','/sdcard/Music/continuity.wav')==audio_before
dump=adb('shell','dumpsys','package',PKG);assert 'versionCode=21' in dump and 'versionName=1.8.3' in dump
adb('shell','logcat','-b','crash','-d')
Path('delivery/evidence/update-result.json').write_text(json.dumps({'result':'passed','android_api':33,'previous_version':'1.8.1','previous_code':19,'new_version':'1.8.3','new_code':21,'installation':'adb install -r','preserved':['local playlist membership/order','favorite and removed rating','theme and artwork-color preferences','external WAV file'],'seed_method':'synthetic fixtures placed with root on test emulator, not user data','physical_phone_tested':False},indent=2))
print('UPDATE_AND_DATA_PRESERVATION_PASSED',flush=True)
