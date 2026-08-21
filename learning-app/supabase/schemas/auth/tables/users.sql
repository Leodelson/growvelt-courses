create trigger on_growvelt_learning_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_growvelt_learning_profile();
