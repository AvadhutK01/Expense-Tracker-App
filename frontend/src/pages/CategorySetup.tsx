import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, LayoutAnimation,
    ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tw from 'tailwind-react-native-classnames';
import apiClient from '../axios/axiosInterceptor';
import { endpoints } from '../axios/endpoint';
import Toast from 'react-native-toast-message';
import CheckBox from '@react-native-community/checkbox';
import { Alert } from 'react-native';

interface CategoryInput {
    name: string;
    amount: string;
    isNew?: boolean;
    isRepeat?: boolean;
    isAddToSavings?: boolean;
    isUsedForExpense?: boolean;
}

interface Props {
    setActiveSection: (section: string | null) => void;
    mode: 'init' | 'add' | 'update' | 'delete';
    updateMode?: 'temporary' | 'permanent';
    onSuccess?: () => void;
}

const CategorySetup: React.FC<Props> = ({ setActiveSection, mode, updateMode, onSuccess }) => {
    const [categories, setCategories] = useState<CategoryInput[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [activeButtonIndex, setActiveButtonIndex] = useState<Record<number, number>>({});

    useEffect(() => {
        if (mode === 'init') {
            setCategories([
                { name: 'savings', amount: '', isNew: true, isUsedForExpense: true, isAddToSavings: true },
                { name: 'loan', amount: '', isNew: true, isUsedForExpense: false, isAddToSavings: false },
            ]);
            setLoading(false);
        } else {
            fetchExistingCategories();
        }
    }, []);

    const showToast = (type: 'success' | 'error', text: string) => {
        Toast.show({
            type,
            text1: text,
            position: 'top'
        });
    };

    const handleToggleSelect = (name: string) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        );
    };

    const handleToggleSavings = (index: number) => {
        const name = categories[index].name.toLowerCase();
        if (name === 'loan' || name === 'savings') return;

        const updated = [...categories];
        updated[index].isAddToSavings = !updated[index].isAddToSavings;
        setCategories(updated);
    };

    const handleToggleExpense = (index: number) => {
        const name = categories[index].name.toLowerCase();
        if (name === 'loan' || name === 'savings') return;

        const updated = [...categories];
        updated[index].isUsedForExpense = !updated[index].isUsedForExpense;
        setCategories(updated);
    };

    const handleLongPress = (index: number) => {
        const name = categories[index].name.toLowerCase();
        if (name === 'loan' || name === 'savings') return;

        let max;
        if (mode === 'add') {
            max = 4; // remove, repeat, wallet, cart
        } else if (mode === 'update' && updateMode === 'temporary') {
            max = 2; // wallet, cart
        } else {
            return; // no cycling for other modes
        }

        setActiveButtonIndex(prev => ({
            ...prev,
            [index]: ((prev[index] || 0) + 1) % max
        }));
    };

    const fetchExistingCategories = async () => {
        try {
            let res;
            if (updateMode === 'permanent') {
                res = await apiClient.get(`${endpoints.categoryEndpoint}?type=recurring`)
            }
            else {
                res = await apiClient.get(endpoints.categoryEndpoint)
            }
            const fetched = res.data.categories.map((c: any) => {
                let isUsedForExpense = c.isUsedForExpense ?? true;
                let isAddToSavings = c.isAddToSavings ?? true;

                if (c.name.toLowerCase() === 'loan') {
                    isUsedForExpense = false;
                    isAddToSavings = false;
                }
                if (c.name.toLowerCase() === 'savings') isUsedForExpense = true;

                return {
                    name: c.name,
                    amount: String(c.amount),
                    isUsedForExpense: isUsedForExpense,
                    isRepeat: updateMode === 'permanent' ? true : c.isRepeat, // Assuming backend returns recurrence
                    isAddToSavings: isAddToSavings,
                    isNew: false,
                };
            });

            if (mode === 'add') {
                setCategories(fetched);
            } else if (mode === 'update') {
                const filtered = updateMode === 'permanent'
                    ? fetched.filter((c: CategoryInput) => c.name.toLowerCase() !== 'loan')
                    : fetched;
                setCategories(filtered);
            }
            else if (mode === 'delete') {
                const filtered = fetched.filter((c: CategoryInput) => c.name.toLowerCase() !== 'loan' && c.name.toLowerCase() !== 'savings');
                setCategories(filtered);
            }
        } catch (err) {
            showToast('error', 'Failed to load categories.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCategories([...categories, { name: '', amount: '', isNew: true, isRepeat: true, isAddToSavings: true, isUsedForExpense: true }]);
    };

    const handleToggleRepeat = (index: number) => {
        const name = categories[index].name.toLowerCase();
        if (name === 'loan' || name === 'savings') return;

        const updated = [...categories];
        updated[index].isRepeat = !updated[index].isRepeat;
        setCategories(updated);
    };

    const handleRemoveRow = (index: number) => {
        const name = categories[index].name.toLowerCase();
        if (['loan', 'savings'].includes(name)) {
            showToast('error', `"${name}" category cannot be removed.`);
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const updated = [...categories];
        updated.splice(index, 1);
        setCategories(updated);
    };

    const handleChange = (index: number, field: keyof CategoryInput, value: string) => {
        const updated = [...categories];
        if (field === 'name' || field === 'amount') {
            updated[index][field] = value;
        }
        setCategories(updated);
    };

    const proceedSubmit = async () => {
        let payload: CategoryInput[] = [];

        payload = categories.filter(c =>
            c.isNew &&
            c.name.trim() &&
            c.amount.trim() &&
            !isNaN(Number(c.amount)) &&
            Number(c.amount) > 0
        );

        if (payload.length === 0 && mode !== 'update') {
            showToast('error', 'Please provide valid name and amount for at least one category.');
            return;
        }

        if (mode === 'add') {
            payload = categories.filter(c => c.isNew && c.name.trim());
        } else {
            payload = categories.filter(c => c.name.trim());
        }

        const apiMap = {
            init: endpoints.categoryIntiate,
            add: endpoints.categoryEndpoint,
            update: endpoints.categoryEndpoint,
            delete: endpoints.deleteCategories
        };

        const requestBody =
            mode === 'update'
                ? { mode: updateMode, categories: payload }
                : payload;

        try {
            setSubmitting(true);
            let response;

            if (mode === 'update') {
                response = await apiClient.put(apiMap[mode], requestBody);
            } else {
                response = await apiClient.post(apiMap[mode], requestBody);
            }

            showToast('success', response.data.message || 'Action completed successfully!');
            if (onSuccess) {
                setTimeout(onSuccess, 1800);
            }
        } catch (err: any) {
            console.error(err);
            showToast('error', err?.response?.data?.message || 'Something went wrong!');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (mode === 'delete') {
            if (selected.length === 0) {
                showToast('error', 'Please select at least one category to delete.');
                return;
            }

            Alert.alert(
                'Confirm Deletion',
                `Are you sure you want to delete ${selected.length} selected categories?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                setSubmitting(true);
                                const res = await apiClient.post(endpoints.deleteCategories, {
                                    names: selected,
                                });
                                showToast('success', res.data.message || 'Categories deleted successfully.');
                                setCategories(prev => prev.filter(c => !selected.includes(c.name)));
                                setSelected([]);
                                if (onSuccess) {
                                    setTimeout(onSuccess, 1800);
                                }
                            } catch (err: any) {
                                console.error(err);
                                showToast('error', err?.response?.data?.message || 'Failed to delete categories.');
                            } finally {
                                setSubmitting(false);
                            }
                        },
                    },
                ]
            );
            return;
        }

        if (mode === 'init') {
            Alert.alert(
                'Confirm Reset',
                'Are you sure you want to reset data?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Yes, Reset', onPress: () => proceedSubmit() },
                ]
            );
            return;
        }

        proceedSubmit();
    };

    const isEditableName = (item: CategoryInput, index: number) => {
        if (mode === 'add') return !!item.isNew;
        const name = item.name.toLowerCase();
        if (['init', 'update'].includes(mode)) {
            return !(name === 'loan' || name === 'savings');
        }
        return false;
    };

    const isEditableAmount = (item: CategoryInput) => {
        if (mode === 'add' || mode === 'delete') return !!item.isNew;
        const name = item.name.toLowerCase();
        if (mode === 'update') {
            if (updateMode === 'temporary') return true;
            return name !== 'loan';
        }
        return true;
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
            <TouchableOpacity onPress={() => setActiveSection(null)} style={tw`mb-3`}>
                <Text style={tw`text-blue-500 text-sm`}>← Back</Text>
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                {categories.map((item, idx) => (
                    <View key={idx} style={tw`flex-row items-center mb-4`}>
                        <View style={tw`flex-1 mr-2`}>
                            <TextInput
                                style={tw`border border-gray-300 rounded px-3 py-2 text-sm ${!isEditableName(item, idx) ? 'bg-gray-100' : ''}`}
                                placeholder="Category name"
                                value={item.name}
                                onChangeText={(text) => handleChange(idx, 'name', text)}
                                editable={isEditableName(item, idx)}
                            />
                        </View>
                        <View style={tw`w-24 mr-2`}>
                            <TextInput
                                style={tw`border border-gray-300 rounded px-3 py-2 text-sm ${!isEditableAmount(item) ? 'bg-gray-100' : ''}`}
                                placeholder="Amount"
                                keyboardType="numeric"
                                value={item.amount}
                                onChangeText={(text) => handleChange(idx, 'amount', text)}
                                editable={isEditableAmount(item)}
                            />
                        </View>

                        <View style={tw`flex-row items-center`}>
                            {!(item.name.toLowerCase() === 'loan' || item.name.toLowerCase() === 'savings') && (
                                <>
                                    {mode === 'add' && item.isNew && (
                                        <>
                                            {(activeButtonIndex[idx] || 0) === 0 && (
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => handleRemoveRow(idx)}
                                                    onLongPress={() => handleLongPress(idx)}
                                                >
                                                    <Ionicons name="remove-circle" size={24} color="red" />
                                                </TouchableOpacity>
                                            )}

                                            {(activeButtonIndex[idx] || 0) === 1 && (
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => handleToggleRepeat(idx)}
                                                    onLongPress={() => handleLongPress(idx)}
                                                >
                                                    <Ionicons
                                                        name="repeat"
                                                        size={22}
                                                        color={item.isRepeat ? 'blue' : 'gray'}
                                                    />
                                                </TouchableOpacity>
                                            )}

                                            {(activeButtonIndex[idx] || 0) === 2 && (
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => handleToggleSavings(idx)}
                                                    onLongPress={() => handleLongPress(idx)}
                                                >
                                                    <Ionicons
                                                        name="wallet"
                                                        size={22}
                                                        color={item.isAddToSavings ? 'green' : 'gray'}
                                                    />
                                                </TouchableOpacity>
                                            )}

                                            {(activeButtonIndex[idx] || 0) === 3 && (
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => handleToggleExpense(idx)}
                                                    onLongPress={() => handleLongPress(idx)}
                                                >
                                                    <Ionicons
                                                        name="cart"
                                                        size={22}
                                                        color={item.isUsedForExpense ? 'orange' : 'gray'}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                        </>
                                    )}

                                    {mode === 'update' && updateMode === 'permanent' && (
                                        <TouchableOpacity style={tw`p-2`} onPress={() => handleToggleRepeat(idx)}>
                                            <Ionicons
                                                name="repeat"
                                                size={22}
                                                color={item.isRepeat ? 'blue' : 'gray'}
                                            />
                                        </TouchableOpacity>
                                    )}

                                    {mode === 'update' && updateMode === 'temporary' && (
                                        <>
                                            {(activeButtonIndex[idx] || 0) === 0 && (
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => handleToggleSavings(idx)}
                                                    onLongPress={() => handleLongPress(idx)}
                                                >
                                                    <Ionicons
                                                        name="wallet"
                                                        size={22}
                                                        color={item.isAddToSavings ? 'green' : 'gray'}
                                                    />
                                                </TouchableOpacity>
                                            )}

                                            {(activeButtonIndex[idx] || 0) === 1 && (
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => handleToggleExpense(idx)}
                                                    onLongPress={() => handleLongPress(idx)}
                                                >
                                                    <Ionicons
                                                        name="cart"
                                                        size={22}
                                                        color={item.isUsedForExpense ? 'orange' : 'gray'}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {mode === 'delete' && !(item.name.toLowerCase() === 'loan' || item.name.toLowerCase() === 'savings') && (
                                <CheckBox
                                    value={selected.includes(item.name)}
                                    onValueChange={() => handleToggleSelect(item.name)}
                                    tintColors={{ true: 'red', false: 'gray' }}
                                />
                            )}
                        </View>

                    </View>
                ))}
            </ScrollView>

            {mode !== 'update' && mode !== 'init' && mode !== 'delete' && (
                <TouchableOpacity
                    style={tw`flex-row items-center justify-start mb-6`}
                    onPress={handleAddRow}
                >
                    <Ionicons name="add-circle-outline" size={24} color="blue" />
                    <Text style={tw`ml-2 text-blue-600`}>Add Category</Text>
                </TouchableOpacity>
            )}

            {mode === 'delete' ? (
                <TouchableOpacity
                    style={tw`bg-red-600 rounded-xl py-3`}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    <Text style={tw`text-center text-white font-semibold`}>
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            'Delete Selected'
                        )}
                    </Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={tw`bg-blue-600 rounded-xl py-3`}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    <Text style={tw`text-center text-white font-semibold`}>
                        {submitting ? <ActivityIndicator size="small" color="#2563EB" /> : 'Submit'}
                    </Text>
                </TouchableOpacity>
            )}

        </View>
    );
};

export default CategorySetup;
