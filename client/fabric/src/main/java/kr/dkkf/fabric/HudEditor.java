package kr.dkkf.fabric;

import kr.dkkf.core.HudProfile;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import org.slf4j.LoggerFactory;

public final class HudEditor extends Screen {
 private HudProfile.Widget selected;private double offsetX,offsetY;private boolean dragging;
 public HudEditor(){super(Text.literal("DKKF HUD Editor"));}
 protected void init(){int y=height-28;
  addDrawableChild(ButtonWidget.builder(Text.literal("Toggle"),b->{if(selected!=null)selected.enabled=!selected.enabled;}).dimensions(8,y,70,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Color"),b->{if(selected!=null)selected.color=selected.color==0x73eee0?0xb69bff:selected.color==0xb69bff?0xffffff:0x73eee0;}).dimensions(83,y,70,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Opacity"),b->{if(selected!=null)selected.opacity=selected.opacity<=.3f?1:selected.opacity-.2f;}).dimensions(158,y,80,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Save & close"),b->close()).dimensions(width-120,y,112,20).build());
 }
 public void render(DrawContext c,int mx,int my,float delta){c.fill(0,0,width,height,0xa008101c);c.drawCenteredTextWithShadow(textRenderer,"DKKF HUD · drag to move · scroll to resize · profile: "+DkkfClient.profile.name,width/2,12,0xff78ead8);DkkfClient.render(c,true);if(selected!=null)c.drawCenteredTextWithShadow(textRenderer,selected.id+" | scale "+String.format(java.util.Locale.ROOT,"%.1f",selected.scale),width/2,height-45,0xffbdcde0);super.render(c,mx,my,delta);}
 public boolean mouseClicked(double x,double y,int button){dragging=false;if(super.mouseClicked(x,y,button))return true;var widgets=DkkfClient.profile.widgets;for(int n=widgets.size()-1;n>=0;n--){var w=widgets.get(n);String value=DkkfClient.adapter.text(w.id);if(value.isEmpty())value=w.id+": none";int width=textRenderer.getWidth(value)+10;if(x>=w.x-2&&x<=w.x+width*w.scale&&y>=w.y-2&&y<=w.y+14*w.scale){selected=w;offsetX=x-w.x;offsetY=y-w.y;dragging=button==0;return true;}}return false;}
 public boolean mouseReleased(double x,double y,int button){dragging=false;return super.mouseReleased(x,y,button);}
 public boolean mouseDragged(double x,double y,int button,double dx,double dy){if(selected!=null&&dragging&&button==0){selected.x=HudProfile.clamp((float)(x-offsetX),0,width-20);selected.y=HudProfile.clamp((float)(y-offsetY),28,height-55);return true;}return super.mouseDragged(x,y,button,dx,dy);}
 public boolean mouseScrolled(double x,double y,double horizontal,double vertical){if(selected!=null){selected.scale=HudProfile.clamp(selected.scale+(float)vertical*.1f,.5f,3);return true;}return super.mouseScrolled(x,y,horizontal,vertical);}
 public void close(){try{DkkfClient.profile.save();}catch(Exception e){LoggerFactory.getLogger("DKKF").warn("Cannot save HUD settings",e);}super.close();}
 public boolean shouldPause(){return false;}
}
