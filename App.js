import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { SidebarProvider } from './src/context/SidebarContext';
import Sidebar from './src/components/Sidebar';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import LoginFormScreen from './src/screens/LoginFormScreen';
import FormularioScreen from './src/screens/FormularioScreen';
import ObraScreen from './src/screens/ObraScreen';
import TrajetoScreen from './src/screens/TrajetoScreen';
import InternoScreen from './src/screens/InternoScreen';
import InternoLoginScreen from './src/screens/InternoLoginScreen';
import FiscalizacaoScreen from './src/screens/FiscalizacaoScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();

  // Enquanto restaura a sessão salva do AsyncStorage, exibe spinner
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Sem usuário → fluxo de login | tercerizado → trajeto | interno → fiscalização
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="LoginForm" component={LoginFormScreen} />
          <Stack.Screen name="LoginInterno" component={InternoLoginScreen} />
        </>
      ) : user.tipo === 'tercerizado' ? (
        <>
          <Stack.Screen name="Formulario" component={FormularioScreen} />
          <Stack.Screen name="Obra" component={ObraScreen} />
          <Stack.Screen name="Trajeto" component={TrajetoScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Interno" component={InternoScreen} />
          <Stack.Screen name="Fiscalizacao" component={FiscalizacaoScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  // Tema e sidebar envolvem tudo; AuthProvider gerencia sessão do usuário
  // Sidebar fica fora do NavigationContainer para sobrepor qualquer tela
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <Sidebar />
        </AuthProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
