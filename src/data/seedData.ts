import { FormerOwner, Vehicle, Sale, Financier, Salesperson, StoreProfile, SystemUser } from '../types';
import { hashPassword } from '../utils/security';

export const SEED_STORE: StoreProfile = {
  nomeFantasia: 'VA Veículos',
  razaoSocial: 'VA Veículos Comércio de Veículos Ltda',
  cnpj: '45.123.890/0001-72',
  telefone: '(83) 3381-1234',
  whatsapp: '(83) 98765-4321',
  endereco: 'Rua São José, 120 - Centro',
  cidade: 'Areial',
  estado: 'PB',
  cep: '58140-000',
  chavePix: 'financeiro@vaveiculos.com.br',
  site: 'www.vaveiculos.com.br',
  logoUrl: '',
  papelTimbrado: {
    logoHeightPx: 64,
    logoAlignment: 'center',
    headerAlignment: 'center',
    marginTopMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 20,
    marginRightMm: 20,
    fontSizePt: 10,
    fontFamily: 'Inter, sans-serif',
    mostrarCnpj: true,
    mostrarEndereco: true,
    mostrarTelefones: true,
    mostrarLinhasAssinatura: true,
    textoRodape: 'VA Veículos · Areial - PB · Rua São José, 120 - Centro · WhatsApp: (83) 98765-4321'
  }
};

export const SEED_FINANCIERS: Financier[] = [
  { id: 'fin_santander', nome: 'Santander Financiamentos', ativa: true },
  { id: 'fin_bv', nome: 'BV Financeira (Banco Votorantim)', ativa: true },
  { id: 'fin_itau', nome: 'Itaú Veículos', ativa: true },
  { id: 'fin_pan', nome: 'Banco PAN Financiamentos', ativa: true },
  { id: 'fin_bradesco', nome: 'Bradesco Financiamentos', ativa: true },
  { id: 'fin_safra', nome: 'Banco Safra Auto', ativa: true }
];

export const SEED_SALESPEOPLE: Salesperson[] = [];

export const SEED_USERS: SystemUser[] = [
  {
    id: 'user_gestor_master',
    nome: 'Gestor Geral',
    email: 'admin@vaveiculos.com.br',
    telefone: '(83) 98765-4321',
    papel: 'gestor',
    senha: hashPassword('Va@2026!', 'admin@vaveiculos.com.br'),
    ativo: true,
    dataCriacao: '2026-01-01T08:00:00Z'
  }
];

export const SEED_OWNERS: FormerOwner[] = [];

export const SEED_VEHICLES: Vehicle[] = [];

export const SEED_SALES: Sale[] = [];
