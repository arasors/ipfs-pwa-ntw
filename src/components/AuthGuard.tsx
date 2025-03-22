import { ReactNode, useEffect, useState } from "react";
import { useUserStore } from "../store/userStore";
import { connectWallet } from "../utils/web3auth";
import { Wallet, AlertCircle } from "lucide-react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";


interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
  allowUnauthenticated?: boolean;
}

export function AuthGuard({
  children,
  redirectTo = "/",
  requireAuth = true,
  allowUnauthenticated = false,
}: AuthGuardProps) {
  
  const { currentUser, setCurrentUser, reset } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedAddress = localStorage.getItem("walletAddress");

    if (storedAddress) {
      setCurrentUser(storedAddress);
    } else if (requireAuth) {
      reset();
      //window.location.href = "/";
    }
    setIsLoading(false);
  }, [setCurrentUser, reset, requireAuth]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const address = await connectWallet();
      if (address) {
        setCurrentUser(address);
        localStorage.setItem("walletAddress", address);
        window.location.href = redirectTo;
      }
    } catch (err) {
      setError("Wallet connection failed. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh" }}>
        <CircularProgress />
      </div>
    );
  }

  if (requireAuth && !currentUser && !allowUnauthenticated) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh", padding: "16px" }}>
        <Card style={{ width: "100%", maxWidth: "400px", padding: "16px", boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)" }}>
          <CardHeader title="Sign In" />
          <CardContent>
            <Typography variant="body2">You need to connect your wallet to view this content.</Typography>
            {error && <Alert severity="error" style={{ marginTop: "16px" }}>{error}</Alert>}
          </CardContent>
          <CardActions style={{ justifyContent: "center" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleConnect}
              disabled={isConnecting}
              startIcon={<Wallet size={20} />}
            >
              {isConnecting ? <CircularProgress size={20} /> : "Connect Wallet"}
            </Button>
          </CardActions>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
