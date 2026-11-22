package kr.dkkf.paper;

import java.util.List;
import org.bukkit.attribute.AttributeModifier.Operation;
import org.bukkit.potion.PotionEffectType;

enum Feature {
    FLIGHT("flight","비행 · Flight"),
    SPEED("speed","이동 속도 · Speed",new Modifier("movement_speed",.75,Operation.ADD_SCALAR)),
    HIGH_JUMP("high_jump","높은 점프 · HighJump",new Modifier("jump_strength",.7,Operation.ADD_SCALAR)),
    STEP("step","높은 발판 · Step",new Modifier("step_height",.6,Operation.ADD_NUMBER)),
    REACH("reach","상호작용 거리 · Reach",new Modifier("block_interaction_range",3,Operation.ADD_NUMBER),new Modifier("entity_interaction_range",1.5,Operation.ADD_NUMBER)),
    FAST_BREAK("fast_break","빠른 채굴 · FastBreak",new Modifier("block_break_speed",3,Operation.ADD_SCALAR)),
    NO_FALL("no_fall","낙하 피해 방지 · NoFall"),
    ANTI_KNOCKBACK("anti_knockback","넉백 저항 · AntiKnockback",new Modifier("knockback_resistance",1,Operation.ADD_NUMBER),new Modifier("explosion_knockback_resistance",1,Operation.ADD_NUMBER)),
    WATER_SPEED("water_speed","수중 이동 · WaterSpeed",new Modifier("water_movement_efficiency",1,Operation.ADD_NUMBER)),
    LOW_GRAVITY("low_gravity","낮은 중력 · LowGravity",new Modifier("gravity",-.65,Operation.ADD_SCALAR)),
    NIGHT_VISION("night_vision","야간 시야 · NightVision",PotionEffectType.NIGHT_VISION),
    WATER_BREATHING("water_breathing","수중 호흡 · WaterBreathing",PotionEffectType.WATER_BREATHING),
    NO_FIRE("no_fire","화염 피해 방지 · NoFire"),
    NO_HUNGER("no_hunger","허기 방지 · NoHunger"),
    REGENERATION("regeneration","재생 · Regeneration",PotionEffectType.REGENERATION),
    AUTO_SPRINT("auto_sprint","자동 달리기 · AutoSprint"),
    AUTO_ATTACK("auto_attack","자동 공격 · AutoAttack"),
    TRIGGER_BOT("trigger_bot","조준 대상 공격 · TriggerBot");

    record Modifier(String attribute,double amount,Operation operation) {}
    final String id,label;
    final List<Modifier> modifiers;
    final PotionEffectType potion;
    Feature(String id,String label,Modifier... modifiers){this.id=id;this.label=label;this.modifiers=List.of(modifiers);this.potion=null;}
    Feature(String id,String label,PotionEffectType potion){this.id=id;this.label=label;this.modifiers=List.of();this.potion=potion;}
    static Feature find(String id){for(var value:values())if(value.id.equals(id))return value;return null;}
}
