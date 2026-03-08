import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../router/MainRoutes'
import tw from 'tailwind-react-native-classnames'
import { Card } from 'react-native-paper'
import apiClient from '../axios/axiosInterceptor'
import { endpoints } from '../axios/endpoint'
import Toast from 'react-native-toast-message'
import { useDashboard } from '../context/DashboardContext'
import { LineChart, PieChart } from 'react-native-chart-kit'

// Icons
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>

type Category = {
  _id: string
  name: string
  amount: number
  trend?: {
    direction: 'up' | 'down'
    changeType: 'add' | 'subtract'
  }
}

type GraphPoint = { date: string; amount: number }

// Dynamic color generator using HSL for visually distinct, pleasant colors
const generateColor = (index: number, total: number): string => {
  const hue = (index * 360 / Math.max(total, 1)) % 360
  const saturation = 65 + (index % 3) * 10 // 65-85%
  const lightness = 45 + (index % 2) * 10 // 45-55%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

const screenWidth = Dimensions.get('window').width

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [topCategories, setTopCategories] = useState<Category[]>([])
  const [otherCategories, setOtherCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState<'dashboard' | 'graphs'>('dashboard')
  const [graphDataReady, setGraphDataReady] = useState(false)
  const [savingsData, setSavingsData] = useState<GraphPoint[]>([])
  const [loanData, setLoanData] = useState<GraphPoint[]>([])
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

  const fetchGraphData = async () => {
    try {
      setGraphDataReady(false)
      const res = await apiClient.get(endpoints.graphData)
      setSavingsData(res.data.savings || [])
      setLoanData(res.data.loan || [])
    } catch (error) {
      console.error('Failed to fetch graph data:', error)
    } finally {
      setGraphDataReady(true)
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
    if (activeTab === 'graphs') {
      fetchGraphData()
    }
  }, [activeTab])


  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    if (activeTab === 'graphs') {
      await fetchGraphData()
    } else {
      await fetchData()
    }
    setRefreshing(false)
  }, [activeTab])

  const renderCategoryCard = (item: Category) => {
    const name = item.name.toLowerCase()
    const isSavings = name === 'savings'
    const isLoan = name === 'loan'

    const renderArrow = () => {
      if (!item.trend) return null;
      const { direction } = item.trend;

      let color = 'gray';
      if (isSavings) {
        color = direction === 'up' ? 'green' : 'red';
      } else if (isLoan) {
        color = direction === 'up' ? 'red' : 'green';
      }

      return (
        <MaterialIcons
          name={direction === 'up' ? 'arrow-upward' : 'arrow-downward'}
          size={18}
          color={color}
          style={tw`ml-1`}
        />
      );
    };

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
            <View style={tw`flex-row items-center`}>
              {isSavings ? (
                <MaterialIcons name="savings" size={24} color="#4B5563" />
              ) : isLoan ? (
                <FontAwesome5 name="money-check-alt" size={22} color="#4B5563" />
              ) : (
                <Text style={tw`text-lg font-semibold text-gray-800`}>{item.name}</Text>
              )}
            </View>
            <View style={tw`flex-row items-center`}>
              <Text style={tw`text-lg font-bold text-blue-600`}>₹{item.amount}</Text>
              {renderArrow()}
            </View>
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

  const renderTabs = () => (
    <View style={tw`px-4 py-3`}>
      <View style={[tw`flex-row rounded-xl p-1`, { backgroundColor: '#E5E7EB' }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('dashboard')}
          style={[
            tw`flex-1 py-2 rounded-lg items-center`,
            activeTab === 'dashboard' ? { backgroundColor: '#fff', elevation: 2 } : {},
          ]}
        >
          <Text style={[
            tw`text-sm font-semibold`,
            { color: activeTab === 'dashboard' ? '#1F2937' : '#6B7280' }
          ]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setGraphDataReady(false)
            setActiveTab('graphs')
          }}
          style={[
            tw`flex-1 py-2 rounded-lg items-center`,
            activeTab === 'graphs' ? { backgroundColor: '#fff', elevation: 2 } : {},
          ]}
        >
          <Text style={[
            tw`text-sm font-semibold`,
            { color: activeTab === 'graphs' ? '#1F2937' : '#6B7280' }
          ]}>Graphs</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderLineChart = () => {
    // Merge all unique dates from both datasets
    const allDates = new Set<string>()
    savingsData.forEach(d => allDates.add(d.date))
    loanData.forEach(d => allDates.add(d.date))

    if (allDates.size === 0) {
      return (
        <View style={[tw`items-center justify-center`, { height: 200 }]}>
          <Text style={tw`text-gray-400`}>No savings/loan data available</Text>
        </View>
      )
    }

    const sortedDates = Array.from(allDates).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number)
      const [db, mb, yb] = b.split('/').map(Number)
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime()
    })

    // Show last 7 days max for readability
    const displayDates = sortedDates.slice(-7)
    const labels = displayDates.map(d => {
      const parts = d.split('/')
      return `${parts[0]}/${parts[1]}`
    })

    const savingsMap = new Map(savingsData.map(d => [d.date, d.amount]))
    const loanMap = new Map(loanData.map(d => [d.date, d.amount]))

    const savingsValues = displayDates.map(d => savingsMap.get(d) || 0)
    const loanValues = displayDates.map(d => loanMap.get(d) || 0)

    // Ensure at least one non-zero value to prevent chart crash
    const safeSavings = savingsValues.every(v => v === 0) ? savingsValues.map(() => 0.01) : savingsValues
    const safeLoan = loanValues.every(v => v === 0) ? loanValues.map(() => 0.01) : loanValues

    return (
      <View>
        <Text style={tw`text-base font-bold text-gray-800 mb-3 px-1`}>Savings vs Loan</Text>
        <View style={tw`flex-row justify-center mb-2`}>
          <View style={tw`flex-row items-center mr-4`}>
            <View style={[tw`w-3 h-3 rounded-full mr-1`, { backgroundColor: '#10B981' }]} />
            <Text style={tw`text-xs text-gray-600`}>Savings</Text>
          </View>
          <View style={tw`flex-row items-center`}>
            <View style={[tw`w-3 h-3 rounded-full mr-1`, { backgroundColor: '#EF4444' }]} />
            <Text style={tw`text-xs text-gray-600`}>Loan</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={{
              labels,
              datasets: [
                {
                  data: safeSavings,
                  color: () => '#10B981',
                  strokeWidth: 2,
                },
                {
                  data: safeLoan,
                  color: () => '#EF4444',
                  strokeWidth: 2,
                },

              ],
            }}
            width={Math.max(screenWidth - 40, labels.length * 60)}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#f9fafb',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(31, 41, 55, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '4', strokeWidth: '1', stroke: '#fafafa' },
            }}
            bezier
            style={{ borderRadius: 16 }}
          />
        </ScrollView>
      </View>
    )
  }

  const renderPieChart = () => {
    const allCategories = [...topCategories, ...otherCategories]
    if (allCategories.length === 0) {
      return (
        <View style={[tw`items-center justify-center`, { height: 200 }]}>
          <Text style={tw`text-gray-400`}>No category data available</Text>
        </View>
      )
    }

    const total = allCategories.length
    const pieData = allCategories.map((cat, index) => {
      let color: string
      const categoryNameLower = cat.name.toLowerCase()
      
      if (categoryNameLower === 'loan') {
        color = '#EF4444' // Red for loan
      } else if (categoryNameLower === 'savings') {
        color = '#10B981' // Green for savings
      } else {
        color = generateColor(index, total) // Dynamic color for others
      }
      
      return {
        name: cat.name.length > 6 ? cat.name.substring(0, 6) + '...' : cat.name,
        amount: cat.amount,
        color,
        legendFontColor: '#4B5563',
        legendFontSize: 12,
      }
    })

    return (
      <View>
        <Text style={tw`text-base font-bold text-gray-800 mb-3 px-1`}>Category Distribution</Text>
        <PieChart
          data={pieData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    )
  }

  const renderGraphsTab = () => {
    if (!graphDataReady) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -60 }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )
    }

    return (
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={tw`px-4 pb-10`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
          />
        }
      >
        <View style={[tw`bg-white rounded-2xl p-4 mb-4`, { elevation: 2 }]}>
          {renderLineChart()}
        </View>
        <View style={[tw`bg-white rounded-2xl p-4`, { elevation: 2 }]}>
          {renderPieChart()}
        </View>
      </ScrollView>
    )
  }

  const renderDashboardTab = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -60 }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )
    }

    if (topCategories.length + otherCategories.length === 0) {
      return (
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
      )
    }

    return (
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
    )
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-100`}>
      {renderTabs()}
      {activeTab === 'dashboard' ? renderDashboardTab() : renderGraphsTab()}
    </SafeAreaView>
  )
}
