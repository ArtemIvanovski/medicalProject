from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import TabletkaByClient
from .serializers import DrugSearchSerializer
from .exceptions import DrugSearchException


class DrugSearchAPIView(APIView):
    """
    API для поиска лекарств по названию
    """

    def get(self, request):
        serializer = DrugSearchSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid request", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        query = serializer.validated_data['query']

        try:
            client = TabletkaByClient()
            results = client.search_drugs(query)
            return Response({"query": query, "results": results})

        except DrugSearchException as e:
            return Response(
                {"error": "Drug search failed", "message": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )