import { AuthOperations } from "../auth/operations";

export const useAuth = () => {
  const getCurrentUser = AuthOperations.currentUser;
  const getCurrentServer = AuthOperations.currentServer;

  return {
    getCurrentUser,
    getCurrentServer,
    login: AuthOperations.login(),
  };
};
