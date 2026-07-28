"""Generate the architecture diagram embedded in the project README.

Requirements:
    Python >= 3.9
    Graphviz
    diagrams == 0.25.1

Run from the repository root:
    python3 scripts/generate-readme-architecture.py

The committed asset was rendered with Graphviz 14.1.2. Other Graphviz versions
can produce small layout differences.
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.generic.compute import Rack
from diagrams.generic.network import Router, Switch
from diagrams.generic.storage import Storage
from diagrams.onprem.client import Client, Users
from diagrams.onprem.compute import Server
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.programming.framework import Nextjs
from diagrams.programming.language import Typescript


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPOSITORY_ROOT / "docs" / "media" / "manypost-architecture"

GRAPH_ATTRIBUTES = {
    "bgcolor": "#FFFFFF",
    "compound": "true",
    "fontcolor": "#111111",
    "fontname": "Arial",
    "fontsize": "24",
    "labeljust": "l",
    "labelloc": "t",
    "newrank": "true",
    "nodesep": "0.4",
    "pad": "0.35",
    "ranksep": "0.75",
    "splines": "spline",
}

NODE_ATTRIBUTES = {
    "color": "#E2E2E7",
    "fillcolor": "#FFFFFF",
    "fontcolor": "#111111",
    "fontname": "Arial",
    "fontsize": "11",
    "margin": "0.12",
    "penwidth": "1.2",
    "style": "rounded,filled",
}

EDGE_ATTRIBUTES = {
    "arrowsize": "0.7",
    "color": "#8E8E96",
    "fontcolor": "#6B6B70",
    "fontname": "Arial",
    "fontsize": "9",
    "penwidth": "1.3",
}

CLUSTER_BASE = {
    "fontcolor": "#6B6B70",
    "fontname": "Arial",
    "fontsize": "12",
    "labeljust": "l",
    "margin": "18",
    "penwidth": "1.2",
    "style": "rounded,filled",
}


def cluster_attributes(background: str, border: str) -> dict[str, str]:
    """Return shared Graphviz attributes for a cluster."""

    return {
        **CLUSTER_BASE,
        "bgcolor": background,
        "color": border,
        "fillcolor": background,
        "pencolor": border,
    }


def generate_diagram() -> None:
    """Render the current operational architecture as a portable PNG."""

    with Diagram(
        "manypost — arquitetura operacional",
        direction="LR",
        filename=str(OUTPUT_PATH),
        outformat="png",
        show=False,
        graph_attr=GRAPH_ATTRIBUTES,
        node_attr=NODE_ATTRIBUTES,
        edge_attr=EDGE_ATTRIBUTES,
    ):
        with Cluster(
            "Interfaces",
            graph_attr=cluster_attributes("#F5F5F7", "#E2E2E7"),
        ):
            teams = Users("Equipes e\nagências")
            machines = Client("Automações e agentes\nREST · MCP")

        with Cluster(
            "manypost · mesmas regras de negócio",
            graph_attr=cluster_attributes("#F6F3FF", "#7C3AED"),
        ):
            web = Nextjs("Next.js web")
            api = Server("Hono API\nREST · MCP · OpenAPI")
            core = Typescript("Core\ncasos de uso + ports")
            jobs = Rack("packages/queue\npg-boss")
            worker = Server("Worker\nhandlers")

        with Cluster(
            "Dados e coordenação",
            graph_attr=cluster_attributes("#F5F5F7", "#E2E2E7"),
        ):
            database = PostgreSQL("PostgreSQL\nestado + jobs pg-boss")
            coordination = Redis("Redis\ncoordenação")
            media = Storage("Mídia\nlocal / S3")
            (
                database
                - Edge(style="invis")
                - coordination
                - Edge(style="invis")
                - media
            )

        with Cluster(
            "Destinos",
            graph_attr=cluster_attributes("#F5F5F7", "#E2E2E7"),
        ):
            adapters = Switch("16 adapters\npackages/providers")
            networks = Router("Redes sociais\ne comunidades")

        teams >> Edge(label="UI", color="#7C3AED") >> web
        web >> Edge(label="HTTP", color="#7C3AED") >> api
        machines >> Edge(label="REST · MCP", color="#7C3AED") >> api

        api >> Edge(color="#7C3AED", penwidth="1.8") >> core
        core >> Edge(label="JobPort") >> jobs
        jobs >> Edge(label="consome") >> worker
        worker >> Edge(
            label="mesmos casos de uso",
            color="#7C3AED",
            constraint="false",
            style="dashed",
        ) >> core

        core >> Edge(label="estado") >> database
        jobs >> Edge(
            constraint="false",
            style="dashed",
        ) >> database
        core >> Edge(label="rate limit · realtime") >> coordination
        core >> Edge(label="mídia") >> media
        core >> Edge(label="provider ports") >> adapters
        adapters >> Edge(color="#7C3AED", penwidth="1.8") >> networks


if __name__ == "__main__":
    generate_diagram()
