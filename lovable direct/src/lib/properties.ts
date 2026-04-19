export type PropertyStatus = "optimal" | "warning" | "critical";

export interface Property {
  id: string;
  name: string;
  code: string;
  status: PropertyStatus;
  high: number;
  low: number;
  image: string;
  tickets: number;
}

export const properties: Property[] = [
  {
    id: "ss-plaza",
    name: "SS Plaza",
    code: "PROP-001",
    status: "optimal",
    high: 465,
    low: 0,
    tickets: 0,
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "rabale",
    name: "Rabale",
    code: "PROP-002",
    status: "optimal",
    high: 0,
    low: 0,
    tickets: 0,
    image:
      "https://images.unsplash.com/photo-1577415124269-fc1140a69e91?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "etpl",
    name: "ETPL Digitide",
    code: "PROP-003",
    status: "warning",
    high: 0,
    low: 0,
    tickets: 0,
    image:
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "head-office",
    name: "Head Office",
    code: "PROP-004",
    status: "optimal",
    high: 2,
    low: 0,
    tickets: 0,
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bajaj-kolkata",
    name: "Bajaj Kolkata",
    code: "PROP-005",
    status: "critical",
    high: 0,
    low: 0,
    tickets: 0,
    image:
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80",
  },
];
