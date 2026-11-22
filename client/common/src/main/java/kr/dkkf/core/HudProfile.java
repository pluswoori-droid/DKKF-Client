package kr.dkkf.core;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/** No game or loader types belong in common. All input is provided by adapters. */
public final class HudProfile {
 public static final List<String> MODULES=List.of("FPS","CPS","Ping","Coordinates","Direction","Keystrokes","Armor Status","Potion Status","Clock","Memory Usage");
 public static final class Widget {
  public final String id; public float x,y,scale=1,opacity=.8f; public int color=0x73eee0; public boolean enabled=true;
  public Widget(String id,float x,float y){this.id=id;this.x=x;this.y=y;}
 }
 public final List<Widget> widgets=new ArrayList<>();
 private final Path directory; public String name="default"; public boolean visible=true;
 public HudProfile(Path directory){this.directory=directory;reset();}
 private void reset(){widgets.clear();for(String id:MODULES)widgets.add(new Widget(id,8,8));visible=true;compact();}
 public void compact(){
  Set<String> shown=switch(name){case "pvp"->Set.of("FPS","CPS","Ping");case "minimal"->Set.of("FPS","Coordinates");default->Set.of("FPS","Ping","Coordinates");};
  int row=0;for(Widget w:widgets){w.enabled=shown.contains(w.id);w.scale=.8f;w.opacity=.85f;w.x=6;if(w.enabled)w.y=6+12*row++;}
  for(Widget w:widgets)if(!w.enabled)w.y=6+12*row++;
  visible=true;
 }
 public void load(String profile) throws IOException {
  if(!Set.of("default","pvp","minimal").contains(profile))throw new IllegalArgumentException("Unknown profile");name=profile;reset();Path file=directory.resolve(profile+".properties");if(!Files.exists(file))return;
  Properties p=new Properties();try(InputStream in=Files.newInputStream(file)){p.load(in);}visible=Boolean.parseBoolean(p.getProperty("hud.visible","true"));for(Widget w:widgets){String k=w.id+".";try{w.x=clamp(Float.parseFloat(p.getProperty(k+"x",String.valueOf(w.x))),0,10000);w.y=clamp(Float.parseFloat(p.getProperty(k+"y",String.valueOf(w.y))),0,10000);w.scale=clamp(Float.parseFloat(p.getProperty(k+"scale",String.valueOf(w.scale))),.5f,3);w.opacity=clamp(Float.parseFloat(p.getProperty(k+"opacity",String.valueOf(w.opacity))),.1f,1);w.color=Integer.parseInt(p.getProperty(k+"color","7597792"))&0xffffff;w.enabled=Boolean.parseBoolean(p.getProperty(k+"enabled",String.valueOf(w.enabled)));}catch(NumberFormatException ignored){/* Invalid widget retains safe defaults. */}}
  // Only migrate the untouched legacy layout; preserve edited profiles and visibility.
  boolean legacy=!p.containsKey("hud.layout");int n=0;for(Widget w:widgets)legacy &= w.enabled && w.x==8 && w.y==8+18*n++ && w.scale==1 && w.opacity==.8f && w.color==0x73eee0;
  if(legacy){boolean wasVisible=visible;compact();visible=wasVisible;}
 }
 public void save() throws IOException {Files.createDirectories(directory);Properties p=new Properties();p.setProperty("hud.layout","2");p.setProperty("hud.visible",String.valueOf(visible));for(Widget w:widgets){String k=w.id+".";p.setProperty(k+"x",String.valueOf(w.x));p.setProperty(k+"y",String.valueOf(w.y));p.setProperty(k+"scale",String.valueOf(w.scale));p.setProperty(k+"opacity",String.valueOf(w.opacity));p.setProperty(k+"color",String.valueOf(w.color));p.setProperty(k+"enabled",String.valueOf(w.enabled));}Path temp=directory.resolve(name+".tmp");try(OutputStream out=Files.newOutputStream(temp)){p.store(out,"DKKF HUD profile");}Files.move(temp,directory.resolve(name+".properties"),StandardCopyOption.REPLACE_EXISTING);}
 public static float clamp(float v,float min,float max){return Float.isFinite(v)?Math.max(min,Math.min(max,v)):min;}
}
