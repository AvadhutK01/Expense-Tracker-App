import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Image,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInstalledApps } from 'react-native-get-app-list';
import tw from 'tailwind-react-native-classnames';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import SendIntentAndroid from 'react-native-send-intent';

interface InstalledApp {
  appName: string;
  packageName: string;
  versionName?: string;
  versionCode?: number;
  firstInstallTime?: number;
  lastUpdateTime?: number;
  systemApp?: boolean;
  icon?: string;
}

interface Props {
  setActiveSection: (section: string | null) => void;
}

export default function FrequentApps({ setActiveSection }: Props) {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [frequentApps, setFrequentApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [frequentLoaded, setFrequentLoaded] = useState(false);

  useEffect(() => {
    loadInstalledApps();
    loadFrequentApps();
  }, []);

  useEffect(() => {
    if (frequentLoaded && frequentApps.length === 0) {
      setEditMode(true);
    }
  }, [frequentApps, frequentLoaded]);

  const loadInstalledApps = async () => {
    try {
      if (Platform.OS !== 'android') {
        setInstalledApps([]);
        setLoading(false);
        return;
      }
      const cached = await AsyncStorage.getItem('@installed_apps')
      if (cached) setInstalledApps(JSON.parse(cached))
    } catch (err) {
      console.error('Error fetching apps:', err);
      Toast.show({
        type: 'error',
        text1: 'Unable to fetch installed apps',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFrequentApps = async () => {
    try {
      const data = await AsyncStorage.getItem('@frequent_apps');
      if (data) {
        setFrequentApps(JSON.parse(data));
      }
    } catch (e) {
      console.error('Error loading frequent apps', e);
    }
    finally {
      setFrequentLoaded(true);
    }
  };

  const saveFrequentApps = async (apps: string[]) => {
    try {
      await AsyncStorage.setItem('@frequent_apps', JSON.stringify(apps));
    } catch (e) {
      console.error('Error saving frequent apps', e);
    }
  };

  const addFrequentApp = async (packageName: string) => {
    try {
      const updated = [...new Set([...frequentApps, packageName])];
      setFrequentApps(updated);
      await saveFrequentApps(updated);
      setEditMode(false);
      Toast.show({ type: 'success', text1: 'Added to Frequent Apps' });
    } catch {
      Toast.show({ type: 'error', text1: 'Error adding app' });
    }
  };

  const removeFrequentApp = async (packageName: string) => {
    try {
      const updated = frequentApps.filter((a) => a !== packageName);
      setFrequentApps(updated);
      await saveFrequentApps(updated);
      setEditMode(false);
      if (updated.length === 0) setEditMode(true);
      Toast.show({ type: 'info', text1: 'Removed from Frequent Apps' });
    } catch {
      Toast.show({ type: 'error', text1: 'Error removing app' });
    }
  };

  const isFrequent = (pkg: string) => frequentApps.includes(pkg);

  const toggleEditMode = () => setEditMode((prev) => !prev);

  const onRefresh = () => {
    setRefreshing(true);
    loadInstalledApps();
  };

  if (loading || refreshing || !frequentLoaded) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-white`}>
        <ActivityIndicator size="large" color="#333" />
        <Text>Loading apps...</Text>
      </View>
    );
  }

  const displayedApps =
    editMode || frequentApps.length === 0
      ? installedApps
      : installedApps.filter((a) => frequentApps.includes(a.packageName));

  return (
    <View>
      <TouchableOpacity onPress={() => setActiveSection(null)} style={tw`mb-3`}>
        <Text style={tw`text-blue-500 text-sm`}>← Back</Text>
      </TouchableOpacity>

      {displayedApps.length === 0 ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <Text style={tw`text-gray-500 text-center`}>
            No frequent apps added yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedApps}
          keyExtractor={(item) => item.packageName}
          numColumns={4}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={tw`pb-4`}
          style={{ maxHeight: 400 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const iconUri =
              item.icon && !item.icon.startsWith('data:')
                ? `data:image/png;base64,${item.icon}`
                : item.icon;

            return (
              <TouchableOpacity
                style={tw`w-1/4 p-2 items-center`}
                onLongPress={toggleEditMode}
                activeOpacity={0.7}
                onPress={async () => {
                  if (editMode) {
                    if (isFrequent(item.packageName)) {
                      await removeFrequentApp(item.packageName);
                    } else {
                      await addFrequentApp(item.packageName);
                    }
                  } else {
                    try {
                      await SendIntentAndroid.openApp(item.packageName, {});
                    } catch (err) {
                      Toast.show({
                        type: 'error',
                        text1: 'Unable to open app',
                        text2: item.appName,
                      });
                      console.error('Error opening app:', err);
                    }
                  }
                }}
              >
                <View style={tw`relative`}>
                  {iconUri ? (
                    <Image
                      source={{ uri: iconUri }}
                      style={{
                        width: 55,
                        height: 55,
                        borderRadius: 55 / 2, // 🟢 Circular icon
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={tw`w-14 h-14 bg-gray-200 rounded-full justify-center items-center border border-gray-300`}
                    >
                      <Text style={tw`text-gray-600 text-xs`}>
                        {item.appName[0]}
                      </Text>
                    </View>
                  )}

                  {editMode && (
                    <View
                      style={tw`absolute -top-1 -right-1 bg-white rounded-full`}
                    >
                      <Ionicons
                        name={
                          isFrequent(item.packageName)
                            ? 'remove-circle'
                            : 'add-circle'
                        }
                        size={22}
                        color={
                          isFrequent(item.packageName)
                            ? '#ef4444'
                            : '#22c55e'
                        }
                      />
                    </View>
                  )}
                </View>

                <Text
                  style={tw`text-xs text-gray-800 text-center mt-1`}
                  numberOfLines={1}
                >
                  {item.appName}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
