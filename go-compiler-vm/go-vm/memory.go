// memory.go — スコープチェーンによる変数管理。
package main

type Memory struct {
	Super *Memory
	Slots map[string]BoObject
	Order []string
}

func NewMemory(super *Memory) *Memory {
	return &Memory{
		Super: super,
		Slots: make(map[string]BoObject),
		Order: []string{},
	}
}

func (m *Memory) SubMemory() *Memory {
	return NewMemory(m)
}

func (m *Memory) Find(name string) map[string]BoObject {
	if _, ok := m.Slots[name]; ok {
		return m.Slots
	} else if m.Super != nil {
		return m.Super.Find(name)
	}
	return nil
}

func (m *Memory) Get(name string) BoObject {
	slot := m.Find(name)
	if slot != nil {
		return slot[name]
	}
	return nil
}

func (m *Memory) Define(name string, value BoObject) BoObject {
	if _, ok := m.Slots[name]; !ok {
		m.Slots[name] = value
		m.Order = append(m.Order, name)
		return value
	}
	return nil
}

func (m *Memory) DefineForce(name string, value BoObject) BoObject {
	if _, ok := m.Slots[name]; !ok {
		m.Order = append(m.Order, name)
	}
	m.Slots[name] = value
	return value
}

func (m *Memory) Update(name string, value BoObject) BoObject {
	slot := m.Find(name)
	if slot != nil {
		slot[name] = value
		return value
	}
	return nil
}
