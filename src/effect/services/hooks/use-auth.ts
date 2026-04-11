import {
  useCurrentServerQuery,
  useCurrentUserQuery,
  useLoginMutation,
} from "../auth/operations";

export const useAuth = () => {
  const getCurrentUser = useCurrentUserQuery;
  const getCurrentServer = useCurrentServerQuery;

  return {
    getCurrentUser,
    getCurrentServer,
    login: useLoginMutation,
  };
};
