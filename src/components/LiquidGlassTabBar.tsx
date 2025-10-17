import React from 'react';
import { StyleSheet, useWindowDimensions, Platform, TouchableOpacity, Text } from 'react-native';
import {
  Canvas,
  ImageShader,
  Skia,
  Fill,
  Shader,
  vec,
  useImage,
} from '@shopify/react-native-skia';
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useDerivedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const liquidGlassShader = Skia.RuntimeEffect.Make(`
uniform float2 iResolution;
uniform shader iChannel0;
uniform float2 pillPosition;  // Center position of the pill
uniform float2 pillSize;      // Width and height of the pill

half4 main(float2 fragCoord) {
    float2 uv = fragCoord / iResolution.xy;
    
    // Calculate distance from pill center
    float2 pillCenter = pillPosition / iResolution.xy;
    float2 pillDimensions = pillSize / iResolution.xy;
    
    // Create pill shape (rounded rectangle) - more precise bounds
    float2 pos = (uv - pillCenter) / (pillDimensions * 0.5);
    
    // Better pill shape calculation
    float2 d = abs(pos) - float2(0.75, 0.25);
    float pillDist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    
    // Only apply effect within reasonable bounds
    float maxDist = 0.3;
    if (pillDist > maxDist) {
        return iChannel0.eval(uv * iResolution.xy);
    }
    
    // Create glass layers with tighter bounds
    float pillMask = 1.0 - smoothstep(0.0, 0.03, pillDist);
    float pillBorder = smoothstep(0.0, 0.01, pillDist) - smoothstep(0.02, 0.04, pillDist);
    float pillGlow = smoothstep(0.02, 0.08, pillDist) - smoothstep(0.06, 0.12, pillDist);
    
    // Only process if we're in the effect area
    float totalMask = pillMask + pillBorder + pillGlow;
    if (totalMask <= 0.01) {
        return iChannel0.eval(uv * iResolution.xy);
    }
    
    // Apply blur effect
    half4 blurredColor = half4(0.0);
    float total = 0.0;
    for (float x = -2.0; x <= 2.0; x++) {
        for (float y = -2.0; y <= 2.0; y++) {
            float2 offset = float2(x, y) * 1.5 / iResolution.xy;
            blurredColor += iChannel0.eval((uv + offset) * iResolution.xy);
            total += 1.0;
        }
    }
    blurredColor /= total;
    
    // Glass material properties - more subtle
    half4 glassTint = half4(0.0, 0.0, 0.05, 0.8);     // Very subtle blue tint
    half4 glassHighlight = half4(0.2, 0.2, 0.3, 1.0); // Subtle highlight
    half4 borderColor = half4(0.4, 0.4, 0.5, 1.0);    // Subtle border
    half4 glowColor = half4(0.1, 0.1, 0.2, 0.2);      // Very subtle glow
    
    // Combine effects more subtly
    half4 finalGlass = blurredColor * 0.8 + glassTint * 0.2;
    finalGlass = mix(finalGlass, glassHighlight, pillBorder * 0.4);
    finalGlass = mix(finalGlass, borderColor, pillBorder * 0.2);
    finalGlass = mix(finalGlass, glowColor, pillGlow * 0.3);
    
    half4 originalColor = iChannel0.eval(uv * iResolution.xy);
    
    // More controlled blending
    float blendFactor = pillMask * 0.7 + pillBorder * 0.5 + pillGlow * 0.2;
    return mix(originalColor, finalGlass, blendFactor);
}`);

interface LiquidGlassTabBarProps extends BottomTabBarProps {}

export default function LiquidGlassTabBar({ state, descriptors, navigation }: LiquidGlassTabBarProps) {
  // Create a dummy background image for the shader (we'll use a solid color texture)
  const backgroundImage = useImage(require('../../assets/adaptive-icon.png')); // Fallback image
  const { width, height } = useWindowDimensions();
  
  // Fixed pill position at bottom center - relative to the constrained canvas
  const pillPosition = useDerivedValue(() => {
    const canvasHeight = Platform.OS === 'ios' ? 100 : 80;
    return vec(width / 2, canvasHeight / 2 + 10); // Center in the canvas area
  }, [width]);
  
  const pillSize = useDerivedValue(() => {
    return vec(width - 40, 60); // Pill dimensions
  }, [width]);

  const uniforms = useDerivedValue(() => {
    const canvasHeight = Platform.OS === 'ios' ? 100 : 80;
    return {
      iResolution: vec(width, canvasHeight), // Use canvas height, not screen height
      pillPosition: pillPosition.value,
      pillSize: pillSize.value,
    };
  }, [pillPosition, pillSize, width]);

  if (!backgroundImage || !liquidGlassShader) {
    return null;
  }

  return (
    <GestureHandlerRootView style={[styles.container, { height: Platform.OS === 'ios' ? 100 : 80 }]}>
      <Canvas style={[
        StyleSheet.absoluteFillObject,
        {
          height: Platform.OS === 'ios' ? 100 : 80,
          bottom: 0,
        }
      ]}>
        <Fill>
          <Shader source={liquidGlassShader} uniforms={uniforms}>
            <ImageShader
              image={backgroundImage}
              fit="cover"
              rect={{ x: 0, y: height - (Platform.OS === 'ios' ? 100 : 80), width, height: Platform.OS === 'ios' ? 100 : 80 }}
            />
          </Shader>
        </Fill>
      </Canvas>
      
      {/* Tab items overlay */}
      <Animated.View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const getIconName = (routeName: string, focused: boolean) => {
            switch (routeName) {
              case 'index':
                return focused ? 'home' : 'home-outline';
              case 'create':
                return focused ? 'add-circle' : 'add-circle-outline';
              case 'settings':
                return focused ? 'settings' : 'settings-outline';
              default:
                return 'ellipse-outline';
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabItem,
                { 
                  opacity: isFocused ? 1 : 0.6,
                  transform: [{ scale: isFocused ? 1.1 : 1 }]
                }
              ]}
            >
              <Ionicons
                name={getIconName(route.name, isFocused) as any}
                size={24}
                color={isFocused ? '#FFFFFF' : '#B0B0B0'}
                style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              />
              <Text style={[
                styles.tabLabel,
                { 
                  color: isFocused ? '#FFFFFF' : '#B0B0B0',
                  textShadowColor: 'rgba(0, 0, 0, 0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }
              ]}>
                {typeof label === 'string' ? label : route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  tabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 20,
    right: 20,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Fallback background
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});