import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  FinanceAccount,
  FinanceTransaction,
  FinanceBudget,
  FinanceSummary,
  ListResponse,
} from '@shared/api.interface';

const PREFIX = '/api/finance';

// ===== Accounts =====

export async function getFinanceAccounts(): Promise<
  ListResponse<FinanceAccount>
> {
  logger.info('[finance] getAccounts');
  const response = await axiosForBackend({
    url: `${PREFIX}/accounts`,
    method: 'GET',
  });
  return response.data;
}

export async function createFinanceAccount(data: {
  name: string;
  type: string;
  balance: number;
  currency?: string;
  color?: string;
  icon?: string;
  note?: string;
}): Promise<FinanceAccount> {
  logger.info('[finance] createAccount', { name: data.name, type: data.type });
  const response = await axiosForBackend({
    url: `${PREFIX}/accounts`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function updateFinanceAccount(
  id: string,
  data: Partial<{
    name: string;
    type: string;
    balance: number;
    currency: string;
    color: string;
    icon: string;
    note: string;
  }>,
): Promise<FinanceAccount> {
  logger.info('[finance] updateAccount', { id });
  const response = await axiosForBackend({
    url: `${PREFIX}/accounts/${id}`,
    method: 'PATCH',
    data,
  });
  return response.data;
}

export async function deleteFinanceAccount(
  id: string,
): Promise<{ success: boolean }> {
  logger.info('[finance] deleteAccount', { id });
  const response = await axiosForBackend({
    url: `${PREFIX}/accounts/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

// ===== Transactions =====

export async function getFinanceTransactions(params?: {
  type?: string;
  category?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<FinanceTransaction>> {
  logger.info('[finance] getTransactions', { params });
  const response = await axiosForBackend({
    url: `${PREFIX}/transactions`,
    method: 'GET',
    params,
  });
  return response.data;
}

export async function getFinanceTransaction(
  id: string,
): Promise<FinanceTransaction> {
  const response = await axiosForBackend({
    url: `${PREFIX}/transactions/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function createFinanceTransaction(data: {
  type: string;
  amount: number;
  category: string;
  subcategory?: string;
  accountId?: string;
  targetAccountId?: string;
  note?: string;
  transactionDate: string;
}): Promise<FinanceTransaction> {
  logger.info('[finance] createTransaction', {
    type: data.type,
    amount: data.amount,
    category: data.category,
  });
  const response = await axiosForBackend({
    url: `${PREFIX}/transactions`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function updateFinanceTransaction(
  id: string,
  data: Partial<{
    type: string;
    amount: number;
    category: string;
    subcategory: string;
    accountId: string;
    targetAccountId: string;
    note: string;
    transactionDate: string;
  }>,
): Promise<FinanceTransaction> {
  logger.info('[finance] updateTransaction', { id });
  const response = await axiosForBackend({
    url: `${PREFIX}/transactions/${id}`,
    method: 'PATCH',
    data,
  });
  return response.data;
}

export async function deleteFinanceTransaction(
  id: string,
): Promise<{ success: boolean }> {
  logger.info('[finance] deleteTransaction', { id });
  const response = await axiosForBackend({
    url: `${PREFIX}/transactions/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

// ===== Budgets =====

export async function getFinanceBudgets(): Promise<
  ListResponse<FinanceBudget>
> {
  logger.info('[finance] getBudgets');
  const response = await axiosForBackend({
    url: `${PREFIX}/budgets`,
    method: 'GET',
  });
  return response.data;
}

export async function createFinanceBudget(data: {
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  periodKey: string;
}): Promise<FinanceBudget> {
  logger.info('[finance] createBudget', {
    category: data.category,
    amount: data.amount,
  });
  const response = await axiosForBackend({
    url: `${PREFIX}/budgets`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function updateFinanceBudget(
  id: string,
  data: Partial<{
    category: string;
    amount: number;
    period: 'monthly' | 'weekly' | 'yearly';
    periodKey: string;
  }>,
): Promise<FinanceBudget> {
  logger.info('[finance] updateBudget', { id });
  const response = await axiosForBackend({
    url: `${PREFIX}/budgets/${id}`,
    method: 'PATCH',
    data,
  });
  return response.data;
}

export async function deleteFinanceBudget(
  id: string,
): Promise<{ success: boolean }> {
  logger.info('[finance] deleteBudget', { id });
  const response = await axiosForBackend({
    url: `${PREFIX}/budgets/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

// ===== Summary =====

export async function getFinanceSummary(params?: {
  month?: string;
}): Promise<FinanceSummary> {
  logger.info('[finance] getSummary', { params });
  const response = await axiosForBackend({
    url: `${PREFIX}/summary`,
    method: 'GET',
    params,
  });
  return response.data;
}
