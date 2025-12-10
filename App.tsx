import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#f00' }}>
      <Slot />
    </GestureHandlerRootView>
  );
}
