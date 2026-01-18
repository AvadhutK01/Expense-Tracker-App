import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../router/MainRoutes'
import tw from 'tailwind-react-native-classnames'
import { Card } from 'react-native-paper'
import apiClient from '../axios/axiosInterceptor'
import { endpoints } from '../axios/endpoint'
import Toast from 'react-native-toast-message'
import { useDashboard } from '../context/DashboardContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getInstalledApps } from 'react-native-get-app-list'

// Icons
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>

type Category = {
  _id: string
  name: string
  amount: number
}

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [topCategories, setTopCategories] = useState<Category[]>([])
  const [otherCategories, setOtherCategories] = useState<Category[]>([])
  const { setRefreshDashboard } = useDashboard()

  const fetchData = async () => {
    try {
      const res = await apiClient.get(endpoints.categoryEndpoint)
      const all = res.data.categories || []
      let top = all.filter(
        (item: Category) =>
          item.name.toLowerCase() === 'savings' || item.name.toLowerCase() === 'loan'
      )

      top.sort((a: any, b: any) => {
        const order = ['savings', 'loan']
        return order.indexOf(a.name.toLowerCase()) - order.indexOf(b.name.toLowerCase())
      })

      const rest = all.filter(
        (item: Category) =>
          item.name.toLowerCase() !== 'loan' && item.name.toLowerCase() !== 'savings'
      )

      setTopCategories(top)
      setOtherCategories(rest)

      if (all.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'No categories found',
          text2: 'Please initiate categories to begin',
        })
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.message || 'Failed to fetch categories',
      })
      console.error('Failed to fetch categories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initFetch = async () => {
      setLoading(true)
      await fetchData()
    }
    initFetch()
    setRefreshDashboard(fetchData)
  }, [])

  useEffect(() => {
    const loadInstalledAppsInBackground = async () => {
      if (Platform.OS !== 'android') return

      try {
        const cached = await AsyncStorage.getItem('@installed_apps')
        if (cached) return;

        const appsRaw = await getInstalledApps()
        const filtered = appsRaw.filter(
          (a: any) => a.packageName !== 'com.anonymous.expense_tracker'
        )

        const formatted = filtered.map((a: any) => ({
          appName: a.appName || a.label,
          packageName: a.packageName,
          icon: a.icon?.startsWith('data:')
            ? a.icon
            : a.icon
              ? `data:image/png;base64,${a.icon}`
              : null,
        }))

        await AsyncStorage.setItem('@installed_apps', JSON.stringify(formatted))
      } catch (err) {
        console.error('⚠️ Error caching installed apps:', err)
      }
    }

    loadInstalledAppsInBackground()
  }, [])


  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [])

  const renderCategoryCard = (item: Category) => {
    const name = item.name.toLowerCase()
    const isSavings = name === 'savings'
    const isLoan = name === 'loan'

    return (
      <Card
        key={item._id}
        style={[
          tw`m-2 flex-1 rounded-2xl`,
          {
            elevation: 4,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 10,
          },
        ]}
      >
        <View style={tw`p-4`}>
          <View style={tw`flex-row justify-between items-center`}>
            {isSavings ? (
              <MaterialIcons name="savings" size={24} color="#4B5563" />
            ) : isLoan ? (
              <FontAwesome5 name="money-check-alt" size={22} color="#4B5563" />
            ) : (
              <Text style={tw`text-lg font-semibold text-gray-800`}>{item.name}</Text>
            )}
            <Text style={tw`text-lg font-bold text-blue-600`}>₹{item.amount}</Text>
          </View>
        </View>
      </Card>
    )
  }

  const renderEmpty = () => (
    <View style={tw`flex-1 justify-center items-center mt-20 px-6`}>
      <Text style={tw`text-xl text-center text-gray-600 font-semibold`}>
        No categories found
      </Text>
      <Text style={tw`text-sm text-center text-gray-500 mt-2`}>
        Please initiate categories from the setup screen.
      </Text>
    </View>
  )

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-100`}>
      <View style={tw`px-4 py-5`}>
        <Text style={tw`text-3xl font-bold text-gray-900`}>Dashboard</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={tw`mt-10`} />
      ) : topCategories.length + otherCategories.length === 0 ? (
        <ScrollView
          contentContainerStyle={tw`flex-1`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563EB']}
            />
          }
        >
          {renderEmpty()}
        </ScrollView>
      ) : (
        <>
          {topCategories.length > 0 && (
            <View style={tw`px-4 mb-3`}>
              <View style={tw`flex-row`}>
                {topCategories.map(renderCategoryCard)}
                {topCategories.length === 1 && <View style={tw`m-2 flex-1`} />}
              </View>
            </View>
          )}

          <ScrollView
            style={tw`flex-1`}
            contentContainerStyle={tw`pb-10 px-4`}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2563EB']}
              />
            }
          >
            {otherCategories.length > 0 &&
              otherCategories.map((item) => (
                <View key={item._id}>{renderCategoryCard(item)}</View>
              ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}
