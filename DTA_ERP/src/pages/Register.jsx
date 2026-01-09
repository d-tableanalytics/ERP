import AuthForm from '../components/AuthForm';
import { register } from '../services/auth';

const Register = () => {
  async function handleSubmit(values) {
    try {
      const res = await register(values);
      // Replace with proper handling (redirect, set auth state)
      console.log('Registered', res);
    } catch (e) {
      console.error('Registration failed', e);
    }
  }

  return (
    <section>
      <h1>Register</h1>
      <AuthForm onSubmit={handleSubmit} showName />
    </section>
  );
};

export default Register;
