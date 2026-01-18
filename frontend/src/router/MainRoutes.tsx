import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import HomeScreen from '../pages/HomeScreen'
import Header from '../components/Header'

export type RootStackParamList = {
    Home: undefined
    Details: { userId: string }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function MainRoutes() {
    return (
        <Stack.Navigator
            initialRouteName="Home"
            screenOptions={({ route }) => ({
                header: () => <Header />,
            })}
        >
            <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
    )
}
