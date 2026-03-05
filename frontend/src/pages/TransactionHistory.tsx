import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    SafeAreaView,
    RefreshControl,
} from 'react-native';
import tw from 'tailwind-react-native-classnames';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../axios/axiosInterceptor';
import { endpoints } from '../axios/endpoint';
import Toast from 'react-native-toast-message';

interface TransactionLog {
    _id: string;
    categoryName: string;
    changeType: 'add' | 'subtract';
    changeAmount: number;
    newAmount: number;
    transaction_note?: string;
    createdAt: string;
}

interface Props {
    onBack: () => void;
}

const TransactionHistory: React.FC<Props> = ({ onBack }) => {
    const [logs, setLogs] = useState<TransactionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchLogs = useCallback(async (pageNum: number, isRefresh: boolean = false) => {
        try {
            if (pageNum === 1) setLoading(true);
            else setLoadingMore(true);

            const res = await apiClient.get(`${endpoints.transactionLogs}?page=${pageNum}&limit=20`);
            const newLogs = res.data.logs;

            if (isRefresh) {
                setLogs(newLogs);
            } else {
                setLogs(prev => [...prev, ...newLogs]);
            }

            setHasMore(newLogs.length === 20);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
            Toast.show({ type: 'error', text1: 'Failed to fetch transaction logs' });
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const onRefresh = () => {
        setRefreshing(true);
        setPage(1);
        fetchLogs(1, true);
    };

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchLogs(nextPage);
        }
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    };

    const renderLogItem = ({ item }: { item: TransactionLog }) => {
        const isAdd = item.changeType === 'add';
        const isLoan = item.categoryName.toLowerCase() === 'loan';
        const amountColor = isLoan ? (isAdd ? '#EF4444' : '#10B981') : (isAdd ? '#10B981' : '#EF4444');
        return (
            <View style={tw`bg-white p-4 mb-3 rounded-xl shadow-sm border border-gray-100`}>
                <View style={tw`flex-row justify-between items-center mb-2`}>
                    <Text style={tw`text-base font-bold text-gray-800`}>{item.categoryName}</Text>
                    <Text style={[tw`text-base font-bold`, { color: amountColor }]}>
                        {isAdd ? '+' : '-'} ₹{item.changeAmount}
                    </Text>
                </View>

                {item.transaction_note && (
                    <Text style={tw`text-sm text-gray-600 mb-2 italic`}>"{item.transaction_note}"</Text>
                )}

                <View style={tw`flex-row justify-between items-center`}>
                    <Text style={tw`text-xs text-gray-400`}>{formatDateTime(item.createdAt)}</Text>
                    <Text style={tw`text-xs text-blue-500 font-medium`}>Bal: ₹{item.newAmount}</Text>
                </View>
            </View>
        );
    };

    return (
        <View>
            <TouchableOpacity onPress={onBack} style={tw`mb-3`}>
                <Text style={tw`text-blue-500 text-sm`}>← Back</Text>
            </TouchableOpacity>

            {loading && page === 1 ? (
                <View style={[tw`justify-center items-center`, { height: 300 }]}>
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <View style={{ height: 400 }}>
                    <FlatList
                        data={logs}
                        renderItem={renderLogItem}
                        keyExtractor={item => item._id}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
                        }
                        ListEmptyComponent={
                            <View style={[tw`items-center justify-center`, { height: 300 }]}>
                                <Ionicons name="receipt-outline" size={64} color="#E5E7EB" />
                                <Text style={tw`text-gray-400 mt-4 text-lg`}>No transactions found</Text>
                            </View>
                        }
                        ListFooterComponent={
                            loadingMore ? <ActivityIndicator size="small" color="#2563EB" style={tw`py-4`} /> : <View style={tw`h-10`} />
                        }
                        contentContainerStyle={tw`pb-5`}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            )}
        </View>
    );
};

export default TransactionHistory;
