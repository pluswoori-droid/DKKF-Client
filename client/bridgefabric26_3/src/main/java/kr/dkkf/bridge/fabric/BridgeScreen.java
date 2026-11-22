package kr.dkkf.bridge.fabric;

import kr.dkkf.bridge.Protocol;
import java.util.*;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

final class BridgeScreen extends Screen {
    private List<Protocol.Feature> shown=List.of();
    private boolean wasConnected;
    private int page;
    private final List<Button> controls=new ArrayList<>();
    BridgeScreen(){super(Component.literal("DKKF 서버 기능"));}
    @Override protected void init(){
        controls.clear();shown=BridgeClient.connected()?BridgeClient.features:List.of();wasConnected=BridgeClient.connected();
        int available=Math.min(620,width-32),buttonWidth=(available-10)/2,left=(width-available)/2;
        int pages=Math.max(1,(shown.size()+7)/8);page=Math.min(page,pages-1);
        for(int n=page*8;n<Math.min(shown.size(),(page+1)*8);n++){
            int row=n-page*8;var feature=shown.get(n);var button=Button.builder(label(feature),b->BridgeClient.toggle(feature.id(),!BridgeClient.features.stream().filter(f->f.id().equals(feature.id())).findFirst().map(Protocol.Feature::enabled).orElse(false))).bounds(left+(row%2)*(buttonWidth+10),70+(row/2)*25,buttonWidth,21).build();controls.add(button);addRenderableWidget(button);
        }
        if(pages>1){var previous=Button.builder(Component.literal("← 이전"),b->{page--;rebuildWidgets();}).bounds(width/2-145,height-55,90,20).build();previous.active=page>0;addRenderableWidget(previous);var next=Button.builder(Component.literal("다음 →"),b->{page++;rebuildWidgets();}).bounds(width/2+55,height-55,90,20).build();next.active=page<pages-1;addRenderableWidget(next);}
        addRenderableWidget(Button.builder(Component.literal("닫기"),b->onClose()).bounds(width/2-60,height-30,120,20).build());
    }
    private Component label(Protocol.Feature feature){return Component.literal((feature.enabled()?"✓ ":"○ ")+feature.label());}
    @Override public void tick(){
        boolean connected=BridgeClient.connected();var current=connected?BridgeClient.features:List.<Protocol.Feature>of();
        if(connected!=wasConnected||!current.equals(shown)){rebuildWidgets();return;}
        for(int n=0;n<controls.size();n++)controls.get(n).active=connected&&System.currentTimeMillis()-BridgeClient.lastToggle>=200;
    }
    @Override public void extractRenderState(GuiGraphicsExtractor graphics,int mx,int my,float delta){
        graphics.fill(0,0,width,height,0xed080f1a);
        graphics.centeredText(font,"DKKF · 서버 연동 기능",width/2,16,0xff93f2df);
        graphics.centeredText(font,BridgeClient.connected()?"DKKF 플러그인 연결됨 · 서버가 허용한 기능만 표시":"연동되지 않음 · DKKF Paper 26.3 플러그인이 필요합니다",width/2,39,0xffa5b9cc);
        if(BridgeClient.connected()&&shown.isEmpty())graphics.centeredText(font,"사용 가능한 기능이 없습니다. 서버 권한과 설정을 확인하세요.",width/2,90,0xffe9be7c);
        if(shown.size()>8)graphics.centeredText(font,(page+1)+" / "+((shown.size()+7)/8),width/2,height-50,0xffc2d4e2);
        super.extractRenderState(graphics,mx,my,delta);
    }
    @Override public boolean isPauseScreen(){return false;}
}
