export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: Record<string, string | number | boolean | undefined>;
};

export const initialState: ActionState = {};
