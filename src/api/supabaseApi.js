import { supabase } from '@/lib/supabaseClient';

function normalizeOrder(orderString) {
  if (!orderString || typeof orderString !== 'string') return null;

  const descending = orderString.startsWith('-');
  const rawColumn = descending ? orderString.slice(1) : orderString;
  const columnMap = {
    created_date: 'created_at',
  };

  return {
    column: columnMap[rawColumn] || rawColumn,
    ascending: !descending,
  };
}

function normalizeListArgs(optionsOrOrder, limit) {
  if (typeof optionsOrOrder === 'string') {
    return {
      order: normalizeOrder(optionsOrOrder),
      limit,
    };
  }

  return optionsOrOrder || {};
}

function normalizeFilterArgs(filters = {}, optionsOrOrder, limit) {
  if (typeof optionsOrOrder === 'string') {
    return {
      eq: filters,
      order: normalizeOrder(optionsOrOrder),
      limit,
    };
  }

  return {
    ...(optionsOrOrder || {}),
    eq: {
      ...filters,
      ...(optionsOrOrder?.eq || {}),
    },
  };
}

function applyListOptions(query, options) {
  if (options.eq) {
    for (const [column, value] of Object.entries(options.eq)) {
      query = query.eq(column, value);
    }
  }

  if (options.neq) {
    for (const [column, value] of Object.entries(options.neq)) {
      query = query.neq(column, value);
    }
  }

  if (options.in) {
    for (const [column, values] of Object.entries(options.in)) {
      query = query.in(column, values);
    }
  }

  if (options.like) {
    for (const [column, pattern] of Object.entries(options.like)) {
      query = query.like(column, pattern);
    }
  }

  if (options.ilike) {
    for (const [column, pattern] of Object.entries(options.ilike)) {
      query = query.ilike(column, pattern);
    }
  }

  if (options.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    });
  }

  if (typeof options.limit === 'number') {
    query = query.limit(options.limit);
  }

  if (options.range) {
    query = query.range(options.range.from, options.range.to);
  }

  return query;
}

export async function list(table, options = {}) {
  options = normalizeListArgs(options);
  let query = supabase.from(table).select(options.select || '*');
  query = applyListOptions(query, options);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function filter(table, filters = {}, optionsOrOrder, limit) {
  const options = normalizeFilterArgs(filters, optionsOrOrder, limit);
  return list(table, options);
}

export async function getById(table, id, options = {}) {
  const { data, error } = await supabase
    .from(table)
    .select(options.select || '*')
    .eq(options.idColumn || 'id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function create(table, payload, options = {}) {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select(options.select || '*')
    .single();

  if (error) throw error;
  return data;
}

export async function update(table, id, payload, options = {}) {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq(options.idColumn || 'id', id)
    .select(options.select || '*')
    .single();

  if (error) throw error;
  return data;
}

export async function remove(table, id, options = {}) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq(options.idColumn || 'id', id)
    .select(options.select || '*')
    .single();

  if (error) throw error;
  return data;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function SupabaseEntityFactory(table) {
  return {
    list: (optionsOrOrder, limit) => list(table, normalizeListArgs(optionsOrOrder, limit)),
    filter: (filters, optionsOrOrder, limit) => filter(table, filters, optionsOrOrder, limit),
    getById: (id, options) => getById(table, id, options),
    create: (payload, options) => create(table, payload, options),
    update: (id, payload, options) => update(table, id, payload, options),
    delete: (id, options) => remove(table, id, options),
    remove: (id, options) => remove(table, id, options),
  };
}
