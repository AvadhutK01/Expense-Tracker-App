import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import tw from 'tailwind-react-native-classnames';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import apiClient from '../axios/axiosInterceptor';
import { endpoints } from '../axios/endpoint';
import { AxiosError } from 'axios';

interface NotesPageProps {
    onBack: () => void;
}

const NotesPage: React.FC<NotesPageProps> = ({ onBack }) => {
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [lastSavedNote, setLastSavedNote] = useState('');
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchNote();
    }, []);

    const fetchNote = async () => {
        try {
            const res = await apiClient.get(endpoints.note);
            if (res.data?.note?.content) {
                setNote(res.data.note.content);
                setLastSavedNote(res.data.note.content);
            } else {
                setNote('');
                setLastSavedNote('');
            }
        } catch (err) {
            console.error('Failed to fetch note:', err);
            if (err instanceof AxiosError && err.response?.status === 404) {
                setNote('');
                setLastSavedNote('');
                return;
            }
            Toast.show({ type: 'error', text1: 'Failed to load notes' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (note !== lastSavedNote) {
            setSaved(false);
            debounceTimer.current = setTimeout(() => {
                saveNote();
            }, 2000);
        }
    }, [note]);

    const saveNote = async () => {
        try {
            setSaving(true);
            startSpinning();
            await apiClient.post(endpoints.note, { content: note });
            setLastSavedNote(note);
            setSaved(true);
        } catch (err: any) {
            console.error('Failed to save note:', err);
            Toast.show({
                type: 'error',
                text1: err?.response?.data?.message || 'Failed to save note',
            });
        } finally {
            setSaving(false);
            stopSpinning();
        }
    };

    const startSpinning = () => {
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    };

    const stopSpinning = () => {
        spinValue.stopAnimation(() => spinValue.setValue(0));
    };

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    if (loading) {
        return (
            <View style={tw`flex-1 justify-center items-center`}>
                <ActivityIndicator size="large" color="blue" />
            </View>
        );
    }

    return (
        <View>
            <View style={tw`flex-row justify-between items-center mb-4`}>
                <TouchableOpacity onPress={onBack} style={tw`mb-3`}>
                    <Text style={tw`text-blue-500 text-sm`}>← Back</Text>
                </TouchableOpacity>

                <View style={tw`mb-3`}>
                    {saving ? (
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name="cloud-upload-outline" size={22} color="#3b82f6" />
                        </Animated.View>
                    ) : saved ? (
                        <Ionicons name="cloud-done-outline" size={22} color="#22c55e" />
                    ) : (
                        <Ionicons name="cloud-outline" size={22} color="#9ca3af" />
                    )}
                </View>
            </View>

            <TextInput
                style={[
                    tw`border border-gray-300 rounded-lg p-3 text-base text-gray-700`,
                    { minHeight: 180, textAlignVertical: 'top' },
                ]}
                placeholder="Write your note here..."
                value={note}
                onChangeText={setNote}
                multiline
            />
        </View>
    );
};

export default NotesPage;
