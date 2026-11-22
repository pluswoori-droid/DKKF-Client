package kr.dkkf.paper;

import kr.dkkf.bridge.Protocol;
import java.security.SecureRandom;
import java.util.*;
import org.bukkit.*;
import org.bukkit.attribute.*;
import org.bukkit.command.*;
import org.bukkit.entity.Player;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Monster;
import org.bukkit.event.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;
import org.bukkit.potion.*;

public final class DkkfBridge extends JavaPlugin implements Listener,PluginMessageListener {
    private final Map<UUID,Session> sessions=new HashMap<>();
    private final Map<UUID,long[]> packetRates=new HashMap<>();
    private final SecureRandom random=new SecureRandom();
    private long ticks;
    private static final class Session {
        long nonce,token,expires,window;int received;
        boolean allowFlight,wasFlying;float flySpeed;
        final Set<Feature> enabled=EnumSet.noneOf(Feature.class);
        final Map<Feature,PotionEffect> previousPotions=new EnumMap<>(Feature.class);
        final Map<Feature,Long> potionStarted=new EnumMap<>(Feature.class);
    }
    @Override public void onEnable(){
        saveDefaultConfig();
        var messenger=getServer().getMessenger();
        messenger.registerIncomingPluginChannel(this,Protocol.CONTROL,this);
        messenger.registerOutgoingPluginChannel(this,Protocol.CONTROL);
        messenger.registerOutgoingPluginChannel(this,Protocol.STATE);
        getServer().getPluginManager().registerEvents(this,this);
        for(var player:getServer().getOnlinePlayers())removeOwnedModifiers(player);
        getServer().getScheduler().runTaskTimer(this,this::tick,5L,5L);
        getLogger().info("DKKF Paper 26.3 bridge enabled. Client features require server permissions.");
    }
    @Override public void onDisable(){
        for(var player:getServer().getOnlinePlayers())reset(player,true);
        sessions.clear();packetRates.clear();
        getServer().getMessenger().unregisterIncomingPluginChannel(this);
        getServer().getMessenger().unregisterOutgoingPluginChannel(this);
    }
    private NamespacedKey key(Feature f,Feature.Modifier m){return new NamespacedKey(this,"feature/"+f.id+"/"+m.attribute());}
    private Attribute attribute(Feature.Modifier m){return Registry.ATTRIBUTE.get(NamespacedKey.minecraft(m.attribute()));}
    private boolean allowed(Player player,Feature feature){
        if(!getConfig().getBoolean("enabled",true)||!getConfig().getBoolean("features."+feature.id,true))return false;
        String permission="dkkfbridge.feature."+feature.id;
        boolean featureAllowed=player.isPermissionSet(permission)?player.hasPermission(permission):player.hasPermission("dkkfbridge.feature.*");
        if(!player.hasPermission("dkkfbridge.use")||!featureAllowed)return false;
        for(var spec:feature.modifiers){var attribute=attribute(spec);if(attribute==null||player.getAttribute(attribute)==null)return false;}
        return true;
    }
    private boolean active(Player player,Feature feature){var s=sessions.get(player.getUniqueId());return s!=null&&s.expires>System.currentTimeMillis()&&s.enabled.contains(feature)&&allowed(player,feature);}
    @Override public void onPluginMessageReceived(String channel,Player player,byte[] bytes){
        if(!Protocol.CONTROL.equals(channel)||bytes.length>Protocol.MAX_BYTES)return;
        if(!Bukkit.isPrimaryThread()){var copy=bytes.clone();getServer().getScheduler().runTask(this,()->receive(player,copy));}else receive(player,bytes);
    }
    private void receive(Player player,byte[] bytes){
        if(!player.isOnline())return;
        try{
            long now=System.currentTimeMillis();var rate=packetRates.computeIfAbsent(player.getUniqueId(),id->new long[]{now,0});
            if(now-rate[0]>=1000){rate[0]=now;rate[1]=0;}if(++rate[1]>32)return;
            var message=Protocol.decode(bytes);
            var s=sessions.get(player.getUniqueId());
            if(s!=null){if(now-s.window>=1000){s.window=now;s.received=0;}if(++s.received>32)return;}
            if(message.op()==Protocol.HELLO){
                if(s==null||s.nonce!=message.nonce()){
                    if(s!=null)reset(player,false);
                    s=new Session();s.nonce=message.nonce();s.token=random.nextLong();if(s.token==0)s.token=1;s.window=now;
                    sessions.put(player.getUniqueId(),s);
                }
                s.expires=now+10000;send(player,s);return;
            }
            if(s==null||s.expires<now||s.nonce!=message.nonce()||s.token!=message.token()||message.op()!=Protocol.TOGGLE)return;
            var feature=Feature.find(message.feature());if(feature==null)return;
            if(message.enabled()&&allowed(player,feature))enable(player,s,feature);else disable(player,s,feature);
            send(player,s);
        }catch(java.io.IOException|IllegalArgumentException ignored){/* Untrusted payloads never become commands or file operations. */}
    }
    private void enable(Player player,Session s,Feature feature){
        if(!s.enabled.add(feature))return;
        if(feature==Feature.FLIGHT){s.allowFlight=player.getAllowFlight();s.wasFlying=player.isFlying();s.flySpeed=player.getFlySpeed();player.setAllowFlight(true);player.setFlySpeed(.1f);player.setFlying(true);}
        for(var spec:feature.modifiers){var instance=player.getAttribute(attribute(spec));if(instance!=null){instance.removeModifier(key(feature,spec));instance.addTransientModifier(new AttributeModifier(key(feature,spec),spec.amount(),spec.operation()));}}
        if(feature.potion!=null){var previous=player.getPotionEffect(feature.potion);if(previous!=null)s.previousPotions.put(feature,previous);s.potionStarted.put(feature,ticks);applyPotion(player,feature);}
        if(feature==Feature.NO_HUNGER){player.setFoodLevel(20);player.setSaturation(20);}
    }
    private void applyPotion(Player player,Feature feature){
        var current=player.getPotionEffect(feature.potion);
        if(current==null||(current.getAmplifier()==0&&current.getDuration()<100))player.addPotionEffect(new PotionEffect(feature.potion,220,0,true,false,false));
    }
    private boolean ours(PotionEffect effect){return effect!=null&&effect.getAmplifier()==0&&effect.getDuration()<=220&&effect.isAmbient()&&!effect.hasParticles()&&!effect.hasIcon();}
    private void disable(Player player,Session s,Feature feature){
        if(!s.enabled.remove(feature))return;
        if(feature==Feature.FLIGHT){if(player.getGameMode()!=GameMode.CREATIVE&&player.getGameMode()!=GameMode.SPECTATOR){if(!s.allowFlight)player.setFlying(false);player.setAllowFlight(s.allowFlight);if(s.allowFlight)player.setFlying(s.wasFlying);}player.setFlySpeed(s.flySpeed);}
        for(var spec:feature.modifiers){var attribute=attribute(spec);var instance=attribute==null?null:player.getAttribute(attribute);if(instance!=null)instance.removeModifier(key(feature,spec));}
        if(feature.potion!=null){
            var current=player.getPotionEffect(feature.potion);var previous=s.previousPotions.remove(feature);long elapsed=ticks-s.potionStarted.getOrDefault(feature,ticks);s.potionStarted.remove(feature);
            if(ours(current)){player.removePotionEffect(feature.potion);if(previous!=null){int remaining=previous.isInfinite()?-1:Math.max(0,previous.getDuration()-(int)elapsed);if(remaining!=0)player.addPotionEffect(new PotionEffect(previous.getType(),remaining,previous.getAmplifier(),previous.isAmbient(),previous.hasParticles(),previous.hasIcon()));}}
        }
    }
    private void removeOwnedModifiers(Player player){for(var feature:Feature.values())for(var spec:feature.modifiers){var attribute=attribute(spec);var instance=attribute==null?null:player.getAttribute(attribute);if(instance!=null)instance.removeModifier(key(feature,spec));}}
    private void reset(Player player,boolean notify){var s=sessions.remove(player.getUniqueId());if(s==null)return;for(var feature:EnumSet.copyOf(s.enabled))disable(player,s,feature);if(notify)sendEmpty(player,s);}
    private void sendEmpty(Player player,Session s){if(player.getListeningPluginChannels().contains(Protocol.STATE))player.sendPluginMessage(this,Protocol.STATE,Protocol.snapshot(s.nonce,s.token,List.of()));}
    private void send(Player player,Session s){
        if(!player.getListeningPluginChannels().contains(Protocol.STATE))return;
        var list=new ArrayList<Protocol.Feature>();for(var feature:Feature.values())if(allowed(player,feature))list.add(new Protocol.Feature(feature.id,feature.label,s.enabled.contains(feature)));
        player.sendPluginMessage(this,Protocol.STATE,Protocol.snapshot(s.nonce,s.token,list));
    }
    private void tick(){
        ticks+=5;long now=System.currentTimeMillis();
        for(var entry:new ArrayList<>(sessions.entrySet())){
            var player=getServer().getPlayer(entry.getKey());var s=entry.getValue();if(player==null){sessions.remove(entry.getKey());continue;}
            if(s.expires<now){reset(player,true);continue;}
            for(var feature:EnumSet.copyOf(s.enabled)){if(!allowed(player,feature)){disable(player,s,feature);continue;}if(feature.potion!=null)applyPotion(player,feature);}
            if(active(player,Feature.NO_FIRE))player.setFireTicks(0);
            if(active(player,Feature.NO_HUNGER)){player.setFoodLevel(20);player.setSaturation(20);}
            if(ticks%10==0&&(active(player,Feature.AUTO_ATTACK)||active(player,Feature.TRIGGER_BOT))&&player.getAttackCooldown()>=.98f)attack(player);
            if(ticks%40==0)send(player,s);
        }
    }
    private boolean target(Player player,org.bukkit.entity.Entity entity){
        if(entity==player||entity.isDead()||!(entity instanceof LivingEntity)||entity.isInvulnerable()||!player.hasLineOfSight(entity))return false;
        if(entity instanceof Player other)return getConfig().getBoolean("combat.target-players",false)&&player.hasPermission("dkkfbridge.combat.players")&&player.getWorld().getPVP()&&other.getGameMode()!=GameMode.SPECTATOR&&other.getGameMode()!=GameMode.CREATIVE;
        return entity instanceof Monster;
    }
    private void attack(Player player){
        var attribute=Registry.ATTRIBUTE.get(NamespacedKey.minecraft("entity_interaction_range"));var instance=attribute==null?null:player.getAttribute(attribute);
        double reach=Math.min(4.5,instance==null?3:instance.getValue());
        org.bukkit.entity.Entity victim=null;
        if(active(player,Feature.TRIGGER_BOT)){
            var ray=player.getWorld().rayTraceEntities(player.getEyeLocation(),player.getEyeLocation().getDirection(),reach,entity->target(player,entity));
            if(ray!=null)victim=ray.getHitEntity();
        }else victim=player.getNearbyEntities(reach,reach,reach).stream().filter(entity->target(player,entity)&&entity.getLocation().distanceSquared(player.getLocation())<=reach*reach).min(Comparator.comparingDouble(entity->entity.getLocation().distanceSquared(player.getLocation()))).orElse(null);
        if(victim!=null){player.attack(victim);player.swingMainHand();}
    }
    @EventHandler public void join(PlayerJoinEvent e){removeOwnedModifiers(e.getPlayer());}
    @EventHandler public void quit(PlayerQuitEvent e){reset(e.getPlayer(),false);packetRates.remove(e.getPlayer().getUniqueId());}
    @EventHandler public void world(PlayerChangedWorldEvent e){reset(e.getPlayer(),true);}
    @EventHandler public void respawn(PlayerRespawnEvent e){reset(e.getPlayer(),true);}
    @EventHandler public void death(PlayerDeathEvent e){reset(e.getEntity(),true);}
    @EventHandler(priority=EventPriority.HIGHEST,ignoreCancelled=true) public void damage(EntityDamageEvent e){
        if(!(e.getEntity() instanceof Player p))return;
        if(e.getCause()==EntityDamageEvent.DamageCause.FALL&&active(p,Feature.NO_FALL))e.setCancelled(true);
        if(active(p,Feature.NO_FIRE)&&Set.of(EntityDamageEvent.DamageCause.FIRE,EntityDamageEvent.DamageCause.FIRE_TICK,EntityDamageEvent.DamageCause.LAVA).contains(e.getCause()))e.setCancelled(true);
    }
    @EventHandler(priority=EventPriority.HIGHEST,ignoreCancelled=true) public void hunger(FoodLevelChangeEvent e){if(e.getEntity() instanceof Player p&&active(p,Feature.NO_HUNGER)){e.setCancelled(true);p.setFoodLevel(20);p.setSaturation(20);}}
    @Override public boolean onCommand(CommandSender sender,Command command,String label,String[] args){
        if(args.length>0&&args[0].equalsIgnoreCase("reload")){
            if(!sender.hasPermission("dkkfbridge.admin")){sender.sendMessage("DKKF: 권한이 없습니다.");return true;}
            for(var p:getServer().getOnlinePlayers())reset(p,true);reloadConfig();sender.sendMessage("DKKF bridge 설정을 다시 불러왔습니다.");
        }else sender.sendMessage("DKKF Bridge 0.1.0 · Paper 26.3 · 클라이언트에서 F10 · 서버 권한에 따라 기능 표시");
        return true;
    }
}
