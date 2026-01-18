import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  KeyboardEvent,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import tw from 'tailwind-react-native-classnames';
import OptionSection, { NestedItem } from './OptionSection';
import CategorySetup from '../pages/CategorySetup';
import ExpensePayment from '../pages/ExpensePayment';
import FrequentApps from '../pages/FrequentApps';
import NotesPage from '../pages/NotesPage';
import Toast from 'react-native-toast-message';
import { useDashboard } from '../context/DashboardContext';
import apiClient from '../axios/axiosInterceptor';
import { endpoints } from '../axios/endpoint';
import { AxiosError } from 'axios';
import BorrowMoney from '../pages/BorrowMoney';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'init' | 'add' | 'update' | 'delete' | 'expense' | 'loan' | 'frequent' | 'notes' | 'borrow' | null;
type UpdateMode = 'permanent' | 'temporary';

const OptionsModal: React.FC<Props> = ({ visible, onClose }) => {
  const [mode, setMode] = useState<Mode>(null);
  const [updateMode, setUpdateMode] = useState<UpdateMode | undefined>();
  const [expenseType, setExpenseType] = useState<'online' | 'offline' | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const { refreshDashboard } = useDashboard();
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
      Animated.timing(keyboardHeight, {
        toValue: 270,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    setMode(null);
    setUpdateMode(undefined);
    setExpenseType(null);
    setExpandedSection(null);
  }, [visible]);

  const handleSuccess = () => {
    refreshDashboard();
    onClose();
  };

  const handleExpand = (label: string) => {
    setExpandedSection((prev) => (prev === label ? null : label));
  };

  useEffect(() => {
    if (mode) {
      setExpandedSection(null);
    }
  }, [mode])

  const handleRevertTransaction = async () => {
    Alert.alert(
      'Confirm Revert',
      'Are you sure you want to revert the latest transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Revert',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.post(endpoints.revertLatestTransaction);
              if (response.status === 200) {
                Toast.show({ type: 'success', text1: 'Transaction Reverted Successfully' });
                setTimeout(handleSuccess, 1800);
              } else {
                Toast.show({ type: 'error', text1: 'Failed to revert transaction' });
              }
            } catch (error) {
              console.error('Error reverting transaction:', error);
              if (error instanceof AxiosError && error.response?.status === 404) {
                Toast.show({ type: 'error', text1: 'No transactions to revert' });
                setTimeout(handleSuccess, 1800);
                return;
              }
              Toast.show({ type: 'error', text1: 'An error occurred while reverting transaction' });
              setTimeout(handleSuccess, 1800);
            }
          },
        },
      ]
    );
  };

  const categoryItems: NestedItem[] = [
    'Add New Categories',
    { label: 'Update Categories', children: ['Recurring', 'Temporary'] },
    'Delete Categories',
  ];

  const renderContent = () => {
    if (mode === 'borrow') {
      return (
        <BorrowMoney
          onBack={() => setMode(null)}
          onSuccess={handleSuccess}
        />
      );
    }
    if (mode && ['expense', 'loan'].includes(mode) && expenseType) {
      return (
        <ExpensePayment
          type={expenseType}
          onBack={() => setMode(null)}
          onSuccess={() => {
            setMode(null);
            setExpenseType(null);
            handleSuccess();
          }}
          isLoanPayment={mode === 'loan'}
        />
      );
    }

    if (mode === 'notes') return <NotesPage onBack={() => setMode(null)} />;
    if (mode === 'frequent') return <FrequentApps setActiveSection={() => setMode(null)} />;
    if (mode && !['expense', 'loan', 'frequent', 'notes'].includes(mode)) {
      return (
        <CategorySetup
          setActiveSection={() => {
            setMode(null);
            setUpdateMode(undefined);
          }}
          mode={mode as 'add' | 'init' | 'update' | 'delete'}
          updateMode={mode === 'update' ? updateMode : undefined}
          onSuccess={handleSuccess}
        />
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <OptionSection
          label="Reset Data"
          onSelect={() => setMode('init')}
          expanded={expandedSection === 'Reset Data'}
          onExpand={handleExpand}
        />

        {/* ✅ Combined Manage Categories */}
        <OptionSection
          label="Manage Categories"
          childrenItems={categoryItems}
          onChildSelect={(label, parentLabel) => {
            if (label === 'Add New Categories') setMode('add');
            else if (parentLabel === 'Update Categories') {
              setMode('update');
              setUpdateMode(label.toLowerCase() === 'recurring' ? 'permanent' : 'temporary');
            } else if (label === 'Delete Categories') setMode('delete');
          }}
          expanded={expandedSection === 'Manage Categories'}
          onExpand={handleExpand}
        />

        <OptionSection
          label="Pay Expenses"
          childrenItems={['Online', 'Offline']}
          onChildSelect={(label) => {
            setMode('expense');
            setExpenseType(label.toLowerCase() as 'online' | 'offline');
          }}
          expanded={expandedSection === 'Pay Expenses'}
          onExpand={handleExpand}
        />

        <OptionSection
          label="Pay Loan"
          childrenItems={['Online', 'Offline']}
          onChildSelect={(label) => {
            setMode('loan');
            setExpenseType(label.toLowerCase() as 'online' | 'offline');
          }}
          expanded={expandedSection === 'Pay Loan'}
          onExpand={handleExpand}
        />


        <OptionSection
          label="Borrow Money"
          onSelect={() => setMode('borrow')}
          expanded={expandedSection === 'Borrow Money'}
          onExpand={handleExpand}
        />


        <OptionSection
          label="Redirection Apps"
          onSelect={() => setMode('frequent')}
          expanded={expandedSection === 'Frequent Apps'}
          onExpand={handleExpand}
        />

        <OptionSection
          label="Revert Latest Transaction"
          onSelect={handleRevertTransaction}
          expanded={expandedSection === 'Revert Latest Transaction'}
          onExpand={handleExpand}
        />

        <OptionSection
          label="Notes"
          onSelect={() => setMode('notes')}
          expanded={expandedSection === 'Notes'}
          onExpand={handleExpand}
        />
      </ScrollView>
    );
  };

  const getTitle = () => {
    if (!mode) return 'Main Menu';
    if (mode === 'borrow') return 'Borrow Money';
    if (mode === 'update') {
      return updateMode === 'permanent'
        ? 'Update Recurring Categories'
        : 'Update Temporary Categories';
    }
    if (mode === 'frequent') return 'Redirection Apps';
    if ((mode === 'expense' || mode === 'loan') && expenseType) {
      return `${mode === 'expense' ? 'Pay Expense' : 'Pay Loan'} ${expenseType === 'online' ? 'Online' : 'Offline'}`;
    }
    if (mode === 'init') return 'Reset Data';
    if (mode === 'delete') return 'Delete Categories';
    if (mode === 'notes') return 'Notes';
    return 'Add New Categories';
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.3}
      style={{ margin: 0, justifyContent: 'flex-end' }}
      useNativeDriver
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          style={[tw`bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-lg`, { marginBottom: keyboardHeight }]}
        >
          <View style={tw`flex-row justify-between items-center mb-4`}>
            <Text style={tw`text-xl font-bold text-gray-900`}>{getTitle()}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color="gray" />
            </TouchableOpacity>
          </View>
          {renderContent()}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default OptionsModal;
