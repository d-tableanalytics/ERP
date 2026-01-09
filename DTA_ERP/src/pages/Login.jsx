import AuthForm from '../components/AuthForm';
import { login } from '../services/auth';

const Login = () => {
  async function handleSubmit(values) {
    try {
      const res = await login(values);
      // Replace with proper handling (redirect, set auth state)
      console.log('Logged in', res);
    } catch (e) {
      console.error('Login failed', e);
    }
  }

  return (
    <section>
      <h1>Login</h1>
      <AuthForm onSubmit={handleSubmit} />
    </section>
  );
};

export default Login;
