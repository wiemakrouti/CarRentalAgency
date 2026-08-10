import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateExpenseInput, UpdateExpenseInput } from '@car-rental/shared';
import { financesApi, type ExpenseListParams } from '../api/finances.api';
import { expenseKeys, financeSummaryKeys } from '../api/finances.keys';

function invalidateExpenseEffects(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
  queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
}

export function useExpensesQuery(params: ExpenseListParams) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => financesApi.listExpenses(params),
  });
}

export function useExpenseQuery(id: string) {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: () => financesApi.getExpenseById(id),
    enabled: Boolean(id),
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => financesApi.createExpense(input),
    onSuccess: () => invalidateExpenseEffects(queryClient),
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => financesApi.updateExpense(id, input),
    onSuccess: (expense) => {
      queryClient.setQueryData(expenseKeys.detail(expense.id), expense);
      invalidateExpenseEffects(queryClient);
    },
  });
}

export function useArchiveExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financesApi.archiveExpense(id),
    onSuccess: () => invalidateExpenseEffects(queryClient),
  });
}

export function useRestoreExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financesApi.restoreExpense(id),
    onSuccess: () => invalidateExpenseEffects(queryClient),
  });
}
