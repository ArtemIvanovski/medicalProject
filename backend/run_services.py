import subprocess
import threading
import time
import os
import sys


def run_service(service_name, port, directory):
    try:
        os.chdir(directory)
        print(f"Starting {service_name} on port {port}")

        subprocess.run([sys.executable, "manage.py", "migrate"], check=True)
        print(f"Migrations completed for {service_name}")

        subprocess.run([
            sys.executable, "manage.py", "runserver", f"localhost:{port}"
        ])
    except subprocess.CalledProcessError as e:
        print(f"Error starting {service_name}: {e}")
    except KeyboardInterrupt:
        print(f"Stopping {service_name}")


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    services = [
        ("auth-service", 8001, os.path.join(base_dir, "services", "auth-service")),
        ("patient-service", 8002, os.path.join(base_dir, "services", "patient-service")),
        ("medication-monitor-service", 8003, os.path.join(base_dir, "services", "medication-monitor-service"))
    ]

    threads = []

    try:
        for service_name, port, directory in services:
            thread = threading.Thread(
                target=run_service,
                args=(service_name, port, directory)
            )
            thread.daemon = True
            thread.start()
            threads.append(thread)
            time.sleep(2)

        print("All services started. Press Ctrl+C to stop.")

        for thread in threads:
            thread.join()

    except KeyboardInterrupt:
        print("\nStopping all services...")
        sys.exit(0)


if __name__ == "__main__":
    main()