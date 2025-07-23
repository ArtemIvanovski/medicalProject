from rest_framework.permissions import BasePermission


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return obj.user == request.user


class HasRole(BasePermission):
    required_roles = []

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        user_roles = request.user.get_active_roles().values_list('name', flat=True)
        return any(role in user_roles for role in self.required_roles)


class IsPatient(HasRole):
    required_roles = ['PATIENT']


class IsDoctor(HasRole):
    required_roles = ['DOCTOR']


class IsAdmin(HasRole):
    required_roles = ['ADMIN']