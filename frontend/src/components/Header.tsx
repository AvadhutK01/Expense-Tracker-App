import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tw from 'tailwind-react-native-classnames';
import OptionsModal from './OptionsModal';

export default function Header() {
  const [modalVisible, setModalVisible] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={tw`bg-gray-100 shadow-sm border-b border-gray-200`}>
      <View style={tw`h-16 flex-row justify-between items-center pt-8 px-4`}>
        <Text style={tw`text-lg font-semibold text-gray-800`}>
          Expense Tracker
        </Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="settings-outline" size={24} color="black" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <OptionsModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}
