import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import tw from 'tailwind-react-native-classnames';
import Toast from 'react-native-toast-message';
import apiClient from '../axios/axiosInterceptor';
import { endpoints } from '../axios/endpoint';

interface BorrowMoneyProps {
  onBack: () => void;
  onSuccess?: () => void;
}

const BorrowMoney: React.FC<BorrowMoneyProps> = ({ onBack, onSuccess }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get(endpoints.categoryEndpoint);
      const filtered = res.data.categories.filter(
        (c: any) => c.name.toLowerCase() !== 'loan'
      );
      setCategories(filtered);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load categories' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!selectedCategory || isNaN(amountNum) || amountNum <= 0) {
      Toast.show({ type: 'error', text1: 'Please enter valid category and amount' });
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(endpoints.borrowMoney, {
        name: selectedCategory,
        amount: amountNum,
      });

      Toast.show({ type: 'success', text1: 'Loan amount transferred successfully' });
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || 'Failed to borrow money',
      });
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
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); onBack(); }} style={tw`mb-3`}>
        <Text style={tw`text-blue-500 text-sm`}>← Back</Text>
      </TouchableOpacity>

      <Text style={tw`mb-2 text-base font-semibold`}>Enter Amount</Text>
      <TextInput
        style={[
          tw`border border-gray-300 rounded px-3 py-2 mb-6`,
          { color: 'black' },
        ]}
        keyboardType="numeric"
        placeholder="Enter amount"
        placeholderTextColor="#999"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={tw`mb-2 text-base font-semibold`}>
        Select Category to transfer loan amount
      </Text>
      <View style={tw`border border-gray-300 rounded mb-6 bg-white`}>
        <Picker
          selectedValue={selectedCategory}
          onValueChange={(val) => setSelectedCategory(val)}
          style={{ color: 'black', backgroundColor: 'white' }}
        >
          <Picker.Item label="Select..." value="" />
          {categories.map((cat: any, idx: number) => (
            <Picker.Item
              key={idx}
              label={`${cat.name} (₹${cat.amount})`}
              value={cat.name}
            />
          ))}
        </Picker>
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        style={tw`bg-blue-600 rounded-xl py-3`}
      >
        <Text style={tw`text-center text-white font-semibold`}>
          {submitting ? 'Processing...' : 'Borrow Money'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default BorrowMoney;
