import type { ModuleConfig } from './types';

export const MODULES: ModuleConfig[] = [
  {
    label: 'Categories', path: 'categories',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. IT' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. IT Equipment' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'icon', label: 'Icon', type: 'text', placeholder: 'e.g. laptop' },
    ],
  },
  {
    label: 'Subcategories', path: 'subcategories',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'category', label: 'Category' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'categoryId', label: 'Category', type: 'select', required: true, options: [] },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. LAP' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Laptop' },
    ],
  },
  {
    label: 'Brands', path: 'brands',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Lenovo' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    label: 'Departments', path: 'departments',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. IT' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Information Technology' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    label: 'Vendors', path: 'vendors',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. V001' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Vendor name' },
      { key: 'contactPerson', label: 'Contact Person', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: 'e.g. +62 812...' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'vendor@example.com' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    label: 'Sites', path: 'sites',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. HQ' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Head Office' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    label: 'Buildings', path: 'buildings',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'siteId', label: 'Site', type: 'select', required: true, options: [] },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. MB' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Main Building' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    label: 'Floors', path: 'floors',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'buildingId', label: 'Building', type: 'select', required: true, options: [] },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. F1' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Floor 1' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    label: 'Rooms', path: 'rooms',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'floorId', label: 'Floor', type: 'select', required: true, options: [] },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. R001' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Server Room' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    label: 'Maintenance Types', path: 'maintenance-types',
    columns: [
      { key: 'code', label: 'Code', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'maintenanceCategory', label: 'Category' },
      { key: 'isActive', label: 'Status' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. CLEANING' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. PC Cleaning' },
      {
        key: 'maintenanceCategory', label: 'Maintenance Category', type: 'select', required: true,
        options: [
          { value: 'PREVENTIVE', label: 'Preventive' },
          { value: 'CORRECTIVE', label: 'Corrective' },
          { value: 'INSPECTION', label: 'Inspection' },
        ],
      },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
];
