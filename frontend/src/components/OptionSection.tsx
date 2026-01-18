import React, { useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tw from 'tailwind-react-native-classnames';

export type NestedItem =
  | string
  | {
      label: string;
      children?: NestedItem[];
    };

interface OptionSectionProps {
  label: string;
  childrenItems?: NestedItem[];
  onSelect?: () => void;
  onChildSelect?: (label: string, parentLabel?: string) => void;
  expanded: boolean;
  onExpand: (label: string) => void;
  level?: number;
}

const OptionSection: React.FC<OptionSectionProps> = ({
  label,
  childrenItems,
  onSelect,
  onChildSelect,
  expanded,
  onExpand,
  level = 0,
}) => {
  const [childExpanded, setChildExpanded] = useState<Record<string, boolean>>({});

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (childrenItems) {
      onExpand(label);
    } else {
      onSelect?.();
    }
  };

  const handleChildExpand = (childLabel: string, e: GestureResponderEvent) => {
    e.stopPropagation(); 
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChildExpanded((prev) => ({
      ...prev,
      [childLabel]: !prev[childLabel],
    }));
  };

  const renderChildren = (items: NestedItem[], parentLabel?: string, depth = 1) => {
    return items.map((item, index) => {
      if (typeof item === 'string') {
        return (
          <TouchableOpacity
            key={index}
            style={[tw`py-2 flex-row items-center`, { paddingLeft: 20 * depth }]}
            onPress={() => onChildSelect?.(item, parentLabel)}
          >
            <Text style={tw`text-sm text-gray-600 mr-1`}>•</Text>
            <Text style={tw`text-sm text-gray-700`}>{item}</Text>
          </TouchableOpacity>
        );
      }

      const isOpen = !!childExpanded[item.label];

      return (
        <View key={index}>
          <TouchableOpacity
            style={[
              tw`flex-row justify-between items-center py-2`,
              { paddingLeft: 20 * depth },
            ]}
            activeOpacity={0.8}
            onPress={(e) => handleChildExpand(item.label, e)}
          >
            <View style={tw`flex-row items-center`}>
              <Text style={tw`text-sm text-gray-600 mr-1`}>•</Text>
              <Text style={tw`text-sm text-gray-700`}>{item.label}</Text>
            </View>
            {item.children && (
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="gray"
              />
            )}
          </TouchableOpacity>

          {isOpen && item.children && renderChildren(item.children, item.label, depth + 1)}
        </View>
      );
    });
  };

  return (
    <View style={tw`mb-1`}>
      <TouchableOpacity
        style={tw`flex-row justify-between items-center py-4`}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={[tw`text-base text-gray-800`, { marginLeft: level * 10 }]}>
          {label}
        </Text>
        {childrenItems && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="gray"
          />
        )}
      </TouchableOpacity>

      {expanded && childrenItems && renderChildren(childrenItems, label)}
    </View>
  );
};

export default OptionSection;
