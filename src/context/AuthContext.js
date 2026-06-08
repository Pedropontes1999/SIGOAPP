import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_USERS, findUserByName } from '../data/mockUsers';
import { saveAuth, loadAuth, clearAuth, clearTrajetoSession, clearObrasList, clearCompletedObras } from '../storage/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // impede render antes de restaurar sessão

  // Restaura usuário salvo no AsyncStorage ao abrir o app
  useEffect(() => {
    loadAuth().then(saved => {
      if (saved) setUser(saved);
      setLoading(false);
    });
  }, []);

  // Busca por sigla ou nome, valida senha e monta objeto de usuário padronizado
  async function login(nome, password) {
    const found = findUserByName(nome) ?? MOCK_USERS[nome];
    if (!found || found.password !== password) return false;

    const userData = {
      username: nome,
      nome: found.nome,
      tipo: found.role,
      sigla: found.sigla || '',
      parceira: found.parceira || '',
      composicao: found.composicao || '',
      tipoEquipe: found.tipoEquipe || '',
      placa: found.placa || '',
      tipoVeiculo: found.tipoVeiculo || '',
      qtdColaboradores: found.qtdColaboradores || 0,
    };
    await saveAuth(userData);
    setUser(userData);
    return true;
  }

  // Limpa auth e qualquer sessão de trajeto em aberto ao sair
  async function logout() {
    await clearAuth();
    await clearTrajetoSession();
    await clearObrasList();
    await clearCompletedObras();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
