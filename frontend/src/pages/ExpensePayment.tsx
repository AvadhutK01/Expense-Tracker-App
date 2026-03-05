import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import tw from 'tailwind-react-native-classnames';
import Toast from 'react-native-toast-message';
import apiClient from '../axios/axiosInterceptor';
import { endpoints } from '../axios/endpoint';
import SendIntentAndroid from 'react-native-send-intent';
import { useDashboard } from '../context/DashboardContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PAYTM_PACKAGE = 'net.one97.paytm';

type ExpensePaymentProps = {
  type: string;
  onBack: () => void;
  onSuccess?: () => void;
  isLoanPayment?: boolean;
};

interface InstalledApp {
  appName: string;
  packageName: string;
  icon?: string;
}

const ExpensePayment: React.FC<ExpensePaymentProps> = ({
  type,
  onBack,
  onSuccess,
  isLoanPayment = false,
}) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [unFilteredCategories, setUnFilteredCategories] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const { showUPIScanner } = useDashboard();

  const [frequentApps, setFrequentApps] = useState<InstalledApp[]>([]);
  const [showAppModal, setShowAppModal] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get(endpoints.categoryEndpoint);
      setUnFilteredCategories(res.data.categories);
      const filtered = res.data.categories.filter(
        (c: any) => c.amount > 0 && c.name.toLowerCase() !== 'loan' && c.isUsedForExpense !== false
      );
      setCategories(filtered);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load categories' });
    } finally {
      setLoading(false);
    }
  };

  const loadFrequentApps = async () => {
    try {
      const data = await AsyncStorage.getItem('@frequent_apps');
      const cache = await AsyncStorage.getItem('@installed_apps');

      if (!data || !cache) return [];
      const pkgNames = JSON.parse(data);
      const installed = JSON.parse(cache);

      return installed.filter((a: any) => pkgNames.includes(a.packageName));
    } catch (err) {
      console.error('Error loading frequent apps:', err);
      return [];
    }
  };

  const launchPaytmFallback = async () => {
    try {
      await SendIntentAndroid.openApp(PAYTM_PACKAGE, {});
    } catch {
      Toast.show({ type: 'error', text1: 'Could not launch Paytm' });
    }
  };

  const openSelectedApp = async (pkg: string) => {
    setShowAppModal(false);
    try {
      await SendIntentAndroid.openApp(pkg, {});
      if (onSuccess) onSuccess();
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to open app' });
    }
  };

  const handlePayment = async () => {
    const selected = categories.find((c) => c.name === selectedCategory);
    const amountNum = Number(amount);

    if (!selectedCategory || isNaN(amountNum) || amountNum <= 0) {
      Toast.show({ type: 'error', text1: 'Please enter valid category and amount' });
      return;
    }

    if (selected?.name.toLowerCase() !== 'loan' && amountNum > selected!.amount) {
      Toast.show({ type: 'error', text1: `Amount exceeds balance for ${selected?.name}` });
      return;
    }

    setSubmitting(true);
    try {
      const apps = await loadFrequentApps();
      if (apps && apps.length === 0) {
        Toast.show({ type: 'info', text1: 'Please add an app in Frequent Apps first' });
        return;
      }
      if (isLoanPayment) {
        await apiClient.post(endpoints.payLoanEndpoint, { name: selectedCategory, amount: amountNum, transaction_note: transactionNote });
      } else {
        await apiClient.patch(endpoints.categoryEndpoint, {
          name: selectedCategory,
          amount: amountNum,
          type: selectedCategory.toLowerCase() === 'loan' ? 'add' : 'subtract',
          transaction_note: transactionNote
        });
      }

      Toast.show({ type: 'success', text1: 'Payment processed successfully' });

      if (type === 'online') {
        if (process.env.EXPO_PUBLIC_IS_UPI_ENABLED === 'true') {
          showUPIScanner(amount, launchPaytmFallback);
          return;
        }

        setFrequentApps(apps);
        setShowAppModal(true);
        return;
      }

      if (onSuccess) setTimeout(onSuccess, 1800);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Payment failed' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={tw`flex-1 justify-center items-center`}>
        <ActivityIndicator size="large" color="blue" />
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity onPress={onBack} style={tw`mb-3`}>
        <Text style={tw`text-blue-500 text-sm`}>← Back</Text>
      </TouchableOpacity>

      <Text style={tw`mb-2 text-base font-semibold`}>Select Category</Text>
      <View style={tw`border border-gray-300 rounded mb-4 bg-white`}>
        <Picker
          selectedValue={selectedCategory}
          onValueChange={(val) => setSelectedCategory(val)}
          style={{ color: 'black', backgroundColor: 'white' }}
        >
          <Picker.Item label="Select..." value="" />
          {categories.map((cat, idx) => (
            <Picker.Item key={idx} label={`${cat.name} (₹${cat.amount})`} value={cat.name} />
          ))}
        </Picker>
      </View>

      <Text style={tw`mb-2 text-base font-semibold`}>Enter Amount</Text>
      <TextInput
        style={[tw`border border-gray-300 rounded px-3 py-2 mb-4`, { color: 'black' }]}
        keyboardType="numeric"
        placeholder="Amount"
        placeholderTextColor="#999"
        value={amount}
        onChangeText={setAmount}
      />

      {!isLoanPayment && (
        <>
          <Text style={tw`mb-2 text-base font-semibold`}>Enter Note (Optional)</Text>
          <TextInput
            style={[tw`border border-gray-300 rounded px-3 py-2 mb-6`, { color: 'black' }]}
            placeholder="Transaction Note"
            placeholderTextColor="#999"
            value={transactionNote}
            onChangeText={setTransactionNote}
          />
        </>
      )}

      <TouchableOpacity
        onPress={handlePayment}
        disabled={submitting}
        style={tw`bg-blue-600 rounded-xl py-3`}
      >
        <Text style={tw`text-center text-white font-semibold`}>
          {submitting ? 'Processing...' : 'Submit'}
        </Text>
      </TouchableOpacity>

      {/* 🔹 Frequent Apps Modal */}
      <Modal visible={showAppModal} transparent animationType="slide">
        <View style={tw`flex-1 bg-black bg-opacity-50 justify-center items-center`}>
          <View style={tw`bg-white w-11/12 rounded-2xl p-4`}>
            <Text style={tw`text-center text-base font-semibold mb-3`}>
              Choose a App
            </Text>
            <FlatList
              data={frequentApps}
              keyExtractor={(item) => item.packageName}
              numColumns={3}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={tw`w-1/3 p-2 items-center`}
                  onPress={() => openSelectedApp(item.packageName)}
                >
                  {item.icon ? (
                    <Image
                      source={{ uri: item.icon }}
                      style={{ width: 55, height: 55, borderRadius: 55 / 2 }}
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
                  <Text
                    style={tw`text-xs text-gray-800 text-center mt-1`}
                    numberOfLines={1}
                  >
                    {item.appName}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ExpensePayment;
